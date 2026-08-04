import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CustomersService } from '../customers/customers.service';
import { FloorsService } from '../villas/floors.service';
import { VillasService } from '../villas/villas.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { InvalidReservationTransitionException } from './exceptions/invalid-reservation-transition.exception';
import { ReservationConflictException } from './exceptions/reservation-conflict.exception';
import { ReservationsRepository, ReservationWithRelations } from './reservations.repository';
import { ReservationStatus } from '../../../generated/prisma/client';

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
  ) {}

  async create(dto: CreateReservationDto): Promise<ReservationWithRelations> {
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

    const conflict = await this.reservationsRepository.findConflicting({
      villaId: dto.villaId,
      floorId: dto.floorId,
      isEntireVillaFloor: floor.isEntireVilla,
      checkIn,
      checkOut,
    });

    if (conflict) {
      throw new ReservationConflictException(conflict.id);
    }

    const nights = this.calculateNights(checkIn, checkOut);
    const totalPrice = Number(floor.dailyPrice) * nights;

    return this.reservationsRepository.create({
      reservationNumber: this.generateReservationNumber(),
      customerId: dto.customerId,
      villaId: dto.villaId,
      floorId: dto.floorId,
      checkIn,
      checkOut,
      guestCount: dto.guestCount,
      totalPrice,
      notes: dto.notes,
    });
  }

  async findAll(
    query: ListReservationsQueryDto,
  ): Promise<{ data: ReservationWithRelations[]; total: number }> {
    const params = {
      villaId: query.villaId,
      customerId: query.customerId,
      status: query.status,
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

    if (dto.guestCount !== undefined) {
      const floor = await this.floorsService.findOneOrThrow(reservation.villaId, reservation.floorId);
      if (dto.guestCount > floor.capacity) {
        throw new BadRequestException(
          `Guest count ${dto.guestCount} exceeds floor capacity ${floor.capacity}`,
        );
      }
    }

    return this.reservationsRepository.update(id, dto);
  }

  async transition(id: string, target: ReservationStatus): Promise<ReservationWithRelations> {
    const reservation = await this.findOneOrThrow(id);
    const allowed = ALLOWED_TRANSITIONS[reservation.status];

    if (!allowed.includes(target)) {
      throw new InvalidReservationTransitionException(reservation.status, target);
    }

    return this.reservationsRepository.update(id, { status: target });
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
