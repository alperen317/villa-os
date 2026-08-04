-- Database-level backstop against double-booking, per ARCHITECTURE.md
-- "Reservation Conflict Safety". This complements (does not replace) the
-- service-layer conflict check in ReservationsService, which is also
-- responsible for the Entire-Villa-vs-Floor cross-unit rule (FR-401/FR-402)
-- that a single-unit EXCLUDE constraint cannot express.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap_per_unit"
  EXCLUDE USING gist (
    villa_id WITH =,
    COALESCE(floor_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (deleted_at IS NULL AND status <> 'Cancelled');

-- Non-negotiable data invariants from docs/DATABASE.md "Constraints"
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_check_out_after_check_in" CHECK (check_out > check_in);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_count_positive" CHECK (guest_count > 0);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_total_price_non_negative" CHECK (total_price >= 0);

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK (amount > 0);

ALTER TABLE "floors" ADD CONSTRAINT "floors_capacity_positive" CHECK (capacity > 0);
ALTER TABLE "floors" ADD CONSTRAINT "floors_daily_price_non_negative" CHECK (daily_price >= 0);
