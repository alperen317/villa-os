import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CustomersService } from '../customers/customers.service';
import { HousekeepingService } from '../housekeeping/housekeeping.service';
import { FloorsService } from '../villas/floors.service';
import { FloorWithVilla } from '../villas/floors.repository';
import { VillasService } from '../villas/villas.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { InvalidReservationTransitionException } from './exceptions/invalid-reservation-transition.exception';
import { ReservationConflictException } from './exceptions/reservation-conflict.exception';
import { ReservationStaleWriteException } from './exceptions/reservation-stale-write.exception';
import { ReservationsRepository, ReservationWithRelations } from './reservations.repository';
import { Prisma, ReservationStatus } from '../../../generated/prisma/client';

const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['CheckedIn', 'Cancelled'],
  CheckedIn: ['CheckedOut'],
  CheckedOut: ['Completed'],
  Completed: [],
  Cancelled: [],
};

@Injectable()
export class ReservationsService {
  constructor(
    private readonly reservationsRepository: ReservationsRepository,
    private readonly villasService: VillasService,
    private readonly floorsService: FloorsService,
    private readonly customersService: CustomersService,
    private readonly housekeepingService: HousekeepingService,
  ) {}

  async create(dto: CreateReservationDto, idempotencyKey?: string): Promise<ReservationWithRelations> {
    if (idempotencyKey) {
      const existing = await this.reservationsRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    await this.villasService.findOneOrThrow(dto.villaId);
    await this.customersService.findOneOrThrow(dto.customerId);
    const floor = await this.floorsService.findOneOrThrow(dto.villaId, dto.floorId);

    if (!floor.rentable) {
      throw new BadRequestException(`Floor ${floor.id} is not rentable`);
    }

    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    if (dto.guestCount > floor.capacity) {
      throw new BadRequestException(
        `Guest count ${dto.guestCount} exceeds floor capacity ${floor.capacity}`,
      );
    }

    const nights = this.calculateNights(checkIn, checkOut);
    const totalPrice = new Prisma.Decimal(floor.dailyPrice).mul(nights);

    // Checking for a conflict and inserting must be atomic: see
    // ReservationsRepository.withVillaLock for why the EXCLUDE constraint alone
    // does not cover the entire-villa-vs-floor case.
    return this.reservationsRepository.withVillaLock(dto.villaId, async (tx) => {
      const conflict = await this.reservationsRepository.findConflicting(
        {
          villaId: dto.villaId,
          floorId: dto.floorId,
          isEntireVillaFloor: floor.isEntireVilla,
          checkIn,
          checkOut,
        },
        tx,
      );

      if (conflict) {
        throw new ReservationConflictException(conflict.id);
      }

      return this.reservationsRepository.create(
        {
          reservationNumber: this.generateReservationNumber(),
          customerId: dto.customerId,
          villaId: dto.villaId,
          floorId: dto.floorId,
          checkIn,
          checkOut,
          guestCount: dto.guestCount,
          totalPrice,
          notes: dto.notes,
          idempotencyKey,
        },
        tx,
      );
    });
  }

  async findAll(
    query: ListReservationsQueryDto,
  ): Promise<{ data: ReservationWithRelations[]; total: number }> {
    const params = {
      villaId: query.villaId,
      customerId: query.customerId,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
    };

    const [data, total] = await Promise.all([
      this.reservationsRepository.findMany({ skip: query.skip, take: query.limit, ...params }),
      this.reservationsRepository.count(params),
    ]);

    return { data, total };
  }

  async findOneOrThrow(id: string): Promise<ReservationWithRelations> {
    const reservation = await this.reservationsRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }

    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto): Promise<ReservationWithRelations> {
    const reservation = await this.findOneOrThrow(id);

    if (
      dto.expectedUpdatedAt !== undefined &&
      new Date(dto.expectedUpdatedAt).getTime() !== reservation.updatedAt.getTime()
    ) {
      throw new ReservationStaleWriteException(reservation.updatedAt);
    }

    if (dto.guestCount !== undefined) {
      const floor = await this.floorsService.findOneOrThrow(reservation.villaId, reservation.floorId);
      if (dto.guestCount > floor.capacity) {
        throw new BadRequestException(
          `Guest count ${dto.guestCount} exceeds floor capacity ${floor.capacity}`,
        );
      }
    }

    return this.reservationsRepository.update(id, {
      guestCount: dto.guestCount,
      notes: dto.notes,
    });
  }

  async transition(id: string, target: ReservationStatus): Promise<ReservationWithRelations> {
    const reservation = await this.findOneOrThrow(id);
    const allowed = ALLOWED_TRANSITIONS[reservation.status];

    if (!allowed.includes(target)) {
      throw new InvalidReservationTransitionException(reservation.status, target);
    }

    const updated = await this.reservationsRepository.update(id, { status: target });

    if (target === ReservationStatus.CheckedOut) {
      await this.housekeepingService.createForReservation(updated.id, updated.villaId);
    }

    return updated;
  }

  async findAvailableFloors(query: AvailabilityQueryDto): Promise<FloorWithVilla[]> {
    const checkIn = new Date(query.checkIn);
    const checkOut = new Date(query.checkOut);

    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const candidates = await this.floorsService.findRentableFloors(query.villaId);

    const availability = await Promise.all(
      candidates.map(async (floor) => {
        const conflict = await this.reservationsRepository.findConflicting({
          villaId: floor.villaId,
          floorId: floor.id,
          isEntireVillaFloor: floor.isEntireVilla,
          checkIn,
          checkOut,
        });
        return conflict ? null : floor;
      }),
    );

    return availability.filter((floor): floor is FloorWithVilla => floor !== null);
  }

  private calculateNights(checkIn: Date, checkOut: Date): number {
    const msPerNight = 24 * 60 * 60 * 1000;
    return Math.round((checkOut.getTime() - checkIn.getTime()) / msPerNight);
  }

  private generateReservationNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = randomBytes(3).toString('hex').toUpperCase();
    return `RES-${datePart}-${randomPart}`;
  }
}
