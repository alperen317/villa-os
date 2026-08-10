import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma, ReservationStatus } from '../../../generated/prisma/client';

export interface ConflictCheckParams {
  villaId: string;
  floorId: string;
  isEntireVillaFloor: boolean;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
}

const RESERVATION_INCLUDE = {
  villa: { select: { id: true, name: true } },
  floor: { select: { id: true, name: true, isEntireVilla: true } },
  customer: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof RESERVATION_INCLUDE;
}>;

/** Either the plain client or one bound to an open transaction. */
export type ReservationsClient = PrismaService | Prisma.TransactionClient;

/** A unit already taken during a window — the shape availability search reasons over. */
export interface BookedUnit {
  villaId: string;
  floorId: string;
  floor: { isEntireVilla: boolean };
}

@Injectable()
export class ReservationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Serializes reservation writes for a single villa.
   *
   * The `reservations_no_overlap_per_unit` EXCLUDE constraint only rejects
   * overlaps on the *same* unit. The entire-villa-vs-floor rule (FR-401/FR-402)
   * is expressed in `findConflicting` instead, so without a lock two concurrent
   * requests — one for the whole villa, one for a single floor — can both pass
   * the check and both commit, double-booking the villa. The advisory lock is
   * held until the surrounding transaction ends.
   */
  withVillaLock<T>(villaId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${villaId})::bigint)`;
      return work(tx);
    });
  }

  create(
    data: Prisma.ReservationUncheckedCreateInput,
    client: ReservationsClient = this.prisma,
  ): Promise<ReservationWithRelations> {
    return client.reservation.create({ data, include: RESERVATION_INCLUDE });
  }

  findById(id: string): Promise<ReservationWithRelations | null> {
    return this.prisma.reservation.findFirst({
      where: { id, deletedAt: null },
      include: RESERVATION_INCLUDE,
    });
  }

  /**
   * Deliberately not filtered on `deletedAt`: the unique index behind the key covers every
   * row, deleted ones included, so hiding a soft-deleted match here would only send the
   * caller on to an insert the database is going to reject anyway. A retry of a request
   * whose reservation was since cancelled should see that reservation, not a constraint
   * error.
   */
  findByIdempotencyKey(
    idempotencyKey: string,
    client: ReservationsClient = this.prisma,
  ): Promise<ReservationWithRelations | null> {
    return client.reservation.findFirst({
      where: { idempotencyKey },
      include: RESERVATION_INCLUDE,
    });
  }

  findMany(params: {
    skip: number;
    take: number;
    villaId?: string;
    customerId?: string;
    status?: ReservationStatus;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<ReservationWithRelations[]> {
    return this.prisma.reservation.findMany({
      where: this.buildWhere(params),
      include: RESERVATION_INCLUDE,
      skip: params.skip,
      take: params.take,
      orderBy: { checkIn: 'desc' },
    });
  }

  count(params: {
    villaId?: string;
    customerId?: string;
    status?: ReservationStatus;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<number> {
    return this.prisma.reservation.count({ where: this.buildWhere(params) });
  }

  private buildWhere(params: {
    villaId?: string;
    customerId?: string;
    status?: ReservationStatus;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Prisma.ReservationWhereInput {
    const where: Prisma.ReservationWhereInput = {
      deletedAt: null,
      villaId: params.villaId,
      customerId: params.customerId,
      status: params.status,
    };

    // Overlap semantics (matches findConflicting): a reservation is "in range"
    // if any part of its stay falls within [dateFrom, dateTo], not just its check-in.
    if (params.dateFrom) {
      where.checkOut = { gt: new Date(params.dateFrom) };
    }
    if (params.dateTo) {
      const exclusiveEnd = new Date(params.dateTo);
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
      where.checkIn = { lt: exclusiveEnd };
    }

    if (params.search?.trim()) {
      const term = params.search.trim();
      where.OR = [
        { reservationNumber: { contains: term, mode: 'insensitive' } },
        { customer: { firstName: { contains: term, mode: 'insensitive' } } },
        { customer: { lastName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  update(id: string, data: Prisma.ReservationUncheckedUpdateInput): Promise<ReservationWithRelations> {
    return this.prisma.reservation.update({ where: { id }, data, include: RESERVATION_INCLUDE });
  }

  /**
   * Note this leaves `idempotencyKey` in place. The key's unique index spans deleted rows
   * too, and `findByIdempotencyKey` deliberately looks past `deletedAt` for that reason: a
   * client replaying a create whose reservation was since deleted should be handed that
   * reservation, not a constraint error from a row it cannot see.
   */
  softDelete(id: string): Promise<ReservationWithRelations> {
    return this.prisma.reservation.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: RESERVATION_INCLUDE,
    });
  }

  /**
   * Moves the status only if the row is still on `from`, and reports whether it did.
   *
   * `updateMany` rather than `update` because the status has to be part of the WHERE, and
   * Prisma's `update` only matches on unique fields. Returning null instead of the row is
   * what lets the caller tell "I moved it" from "someone else moved it first" — the two are
   * indistinguishable once the write has landed.
   *
   * `updatedAt` is set here rather than left to the `@updatedAt` attribute. The optimistic
   * concurrency check in `ReservationsService.update` compares against that column, so a
   * transition that failed to move it would quietly hand out a stale token — too load-bearing
   * to rest on which Prisma write paths populate the attribute.
   */
  async updateStatusFrom(
    id: string,
    from: ReservationStatus,
    to: ReservationStatus,
  ): Promise<ReservationWithRelations | null> {
    const { count } = await this.prisma.reservation.updateMany({
      where: { id, status: from, deletedAt: null },
      data: { status: to, updatedAt: new Date() },
    });

    return count === 0 ? null : this.findById(id);
  }

  /**
   * Queried straight off the payments table rather than through PaymentsService, which
   * already depends on this module — going the other way would close the cycle.
   */
  async hasPayments(reservationId: string): Promise<boolean> {
    return (await this.prisma.payment.count({ where: { reservationId } })) > 0;
  }

  /**
   * Every unit taken during the window across a set of villas, in one query.
   *
   * `findConflicting` answers the same question for a single unit, which is right when there
   * *is* a single unit — but availability search asks it of every rentable floor at once, and
   * asking one query per floor means one query per floor in the system when no villa is
   * chosen. The caller applies the FR-401/FR-402 rules over this set instead.
   *
   * Filtered on `reservation.villaId` rather than `floor.villaId` so the (villaId, checkIn)
   * index carries the scan; a reservation's floor always belongs to its villa, which `create`
   * enforces through `FloorsService.findOneOrThrow`.
   */
  findOverlappingUnits(
    villaIds: string[],
    checkIn: Date,
    checkOut: Date,
  ): Promise<BookedUnit[]> {
    return this.prisma.reservation.findMany({
      where: {
        villaId: { in: villaIds },
        deletedAt: null,
        status: { not: 'Cancelled' },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { villaId: true, floorId: true, floor: { select: { isEntireVilla: true } } },
    });
  }

  /**
   * Entire-villa floor: conflicts with any reservation on any floor of the villa.
   * Regular floor: conflicts with reservations on the same floor, and with the
   * villa's entire-villa floor (FR-401/FR-402) — but not with other regular floors.
   */
  findConflicting(
    params: ConflictCheckParams,
    client: ReservationsClient = this.prisma,
  ): Promise<ReservationWithRelations | null> {
    const unitFilter: Prisma.ReservationWhereInput = params.isEntireVillaFloor
      ? { floor: { villaId: params.villaId } }
      : {
          OR: [
            { floorId: params.floorId },
            { floor: { villaId: params.villaId, isEntireVilla: true } },
          ],
        };

    return client.reservation.findFirst({
      where: {
        ...unitFilter,
        deletedAt: null,
        status: { not: 'Cancelled' },
        checkIn: { lt: params.checkOut },
        checkOut: { gt: params.checkIn },
        ...(params.excludeReservationId ? { id: { not: params.excludeReservationId } } : {}),
      },
      include: RESERVATION_INCLUDE,
    });
  }
}
