import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma, Reservation, ReservationStatus } from '../../../generated/prisma/client';

export interface ConflictCheckParams {
  villaId: string;
  floorId: string;
  isEntireVillaFloor: boolean;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
}

@Injectable()
export class ReservationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ReservationUncheckedCreateInput): Promise<Reservation> {
    return this.prisma.reservation.create({ data });
  }

  findById(id: string): Promise<Reservation | null> {
    return this.prisma.reservation.findFirst({ where: { id, deletedAt: null } });
  }

  findMany(params: {
    skip: number;
    take: number;
    villaId?: string;
    customerId?: string;
    status?: ReservationStatus;
  }): Promise<Reservation[]> {
    return this.prisma.reservation.findMany({
      where: {
        deletedAt: null,
        villaId: params.villaId,
        customerId: params.customerId,
        status: params.status,
      },
      skip: params.skip,
      take: params.take,
      orderBy: { checkIn: 'desc' },
    });
  }

  count(params: { villaId?: string; customerId?: string; status?: ReservationStatus }): Promise<number> {
    return this.prisma.reservation.count({
      where: {
        deletedAt: null,
        villaId: params.villaId,
        customerId: params.customerId,
        status: params.status,
      },
    });
  }

  update(id: string, data: Prisma.ReservationUncheckedUpdateInput): Promise<Reservation> {
    return this.prisma.reservation.update({ where: { id }, data });
  }

  /**
   * Entire-villa floor: conflicts with any reservation on any floor of the villa.
   * Regular floor: conflicts with reservations on the same floor, and with the
   * villa's entire-villa floor (FR-401/FR-402) — but not with other regular floors.
   */
  findConflicting(params: ConflictCheckParams): Promise<Reservation | null> {
    const unitFilter: Prisma.ReservationWhereInput = params.isEntireVillaFloor
      ? { floor: { villaId: params.villaId } }
      : {
          OR: [
            { floorId: params.floorId },
            { floor: { villaId: params.villaId, isEntireVilla: true } },
          ],
        };

    return this.prisma.reservation.findFirst({
      where: {
        ...unitFilter,
        deletedAt: null,
        status: { not: 'Cancelled' },
        checkIn: { lt: params.checkOut },
        checkOut: { gt: params.checkIn },
        ...(params.excludeReservationId ? { id: { not: params.excludeReservationId } } : {}),
      },
    });
  }
}
