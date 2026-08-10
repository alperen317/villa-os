import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AppException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
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

  async create(
    dto: CreateReservationDto,
    idempotencyKey?: string,
  ): Promise<ReservationWithRelations> {
    // A cheap pre-check outside the lock: the overwhelmingly common retry is a sequential
    // one, and answering it here costs a single indexed read instead of a lock acquisition.
    // The authoritative check is repeated inside the lock below, which is what makes
    // *concurrent* retries safe.
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
      // Re-checked here, not just above: two replays of the same queued write can both miss
      // the pre-check and then queue up on the lock. Without this the second one reaches the
      // conflict check, matches the reservation the first one just made, and comes back as a
      // double-booking — turning a retry into an error the client cannot act on. Inside the
      // lock the loser sees the winner's row and returns it, which is what the key promises.
      if (idempotencyKey) {
        const existing = await this.reservationsRepository.findByIdempotencyKey(idempotencyKey, tx);
        if (existing) {
          return existing;
        }
      }

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
      const floor = await this.floorsService.findOneOrThrow(
        reservation.villaId,
        reservation.floorId,
      );
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

    // The check above reads the status and the write below changes it — between the two, a
    // second request (a double-tap, an outbox replay) can pass the same check. The write
    // carries the expected status so the database decides the winner: the loser matches no
    // row and is told so, instead of both sides proceeding and check-out queueing two
    // housekeeping tasks for one stay.
    const updated = await this.reservationsRepository.updateStatusFrom(
      id,
      reservation.status,
      target,
    );

    if (!updated) {
      const current = await this.findOneOrThrow(id);
      throw new InvalidReservationTransitionException(current.status, target);
    }

    if (target === ReservationStatus.CheckedOut) {
      await this.housekeepingService.createForReservation(updated.id, updated.villaId);
    }

    return updated;
  }

  /**
   * Soft-deletes a reservation — for a booking entered by mistake, not for one that fell
   * through; a guest who cancels goes through the Cancelled transition, which keeps the stay
   * in the record and in the reports.
   *
   * Two things are refused rather than hidden. A CheckedIn stay is a guest currently in the
   * unit, and deleting it drops the row out of every conflict check, so the unit would read
   * as free while it is occupied. A reservation with payments against it is the only link
   * those payments have to a villa, a customer and a date — removing it from every query
   * that filters `deletedAt` would leave the money recorded but unattributable.
   */
  async remove(id: string): Promise<void> {
    const reservation = await this.findOneOrThrow(id);

    if (reservation.status === ReservationStatus.CheckedIn) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.RESERVATION_DELETE_IN_STAY,
        'A reservation cannot be deleted while the guest is checked in',
      );
    }

    if (await this.reservationsRepository.hasPayments(id)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.RESERVATION_DELETE_HAS_PAYMENTS,
        'A reservation with recorded payments cannot be deleted',
      );
    }

    await this.reservationsRepository.softDelete(id);
  }

  async findAvailableFloors(query: AvailabilityQueryDto): Promise<FloorWithVilla[]> {
    const checkIn = new Date(query.checkIn);
    const checkOut = new Date(query.checkOut);

    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const candidates = await this.floorsService.findRentableFloors(query.villaId);
    if (candidates.length === 0) {
      return [];
    }

    // One query for every candidate, rather than a conflict check per floor: `villaId` is
    // optional, so an unscoped search would otherwise issue one query per rentable floor in
    // the system. The FR-401/FR-402 rules are applied over the result here instead — the same
    // ones `findConflicting` expresses in SQL for the single-unit case.
    const villaIds = [...new Set(candidates.map((floor) => floor.villaId))];
    const booked = await this.reservationsRepository.findOverlappingUnits(
      villaIds,
      checkIn,
      checkOut,
    );

    const bookedFloorIds = new Set(booked.map((unit) => unit.floorId));
    const villasWithAnyBooking = new Set(booked.map((unit) => unit.villaId));
    const villasBookedWhole = new Set(
      booked.filter((unit) => unit.floor.isEntireVilla).map((unit) => unit.villaId),
    );

    return candidates.filter((floor) =>
      floor.isEntireVilla
        ? // Letting the whole villa needs every floor of it free.
          !villasWithAnyBooking.has(floor.villaId)
        : // A single floor needs itself free, and the villa not let out whole.
          !bookedFloorIds.has(floor.id) && !villasBookedWhole.has(floor.villaId),
    );
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
