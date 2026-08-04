/*
  Warnings:

  - Made the column `floor_id` on table `reservations` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_floor_id_fkey";

-- AlterTable
ALTER TABLE "floors" ADD COLUMN     "is_entire_villa" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reservations" ALTER COLUMN "floor_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- "Entire Villa" is now modeled as a Floor row (is_entire_villa = true) instead of a
-- nullable reservations.floor_id, so the per-unit EXCLUDE constraint from the
-- previous migration can be keyed on floor_id directly (no more COALESCE sentinel).
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_no_overlap_per_unit";

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap_per_unit"
  EXCLUDE USING gist (
    floor_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (deleted_at IS NULL AND status <> 'Cancelled');

-- A villa may have at most one "Entire Villa" floor row.
CREATE UNIQUE INDEX "floors_one_entire_villa_per_villa"
  ON "floors" ("villa_id")
  WHERE ("is_entire_villa" = true AND "deleted_at" IS NULL);
