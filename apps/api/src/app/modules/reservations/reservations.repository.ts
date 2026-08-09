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

  findByIdempotencyKey(idempotencyKey: string): Promise<ReservationWithRelations | null> {
    return this.prisma.reservation.findFirst({
      where: { idempotencyKey, deletedAt: null },
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
