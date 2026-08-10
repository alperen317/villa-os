import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCode } from '../../common/errors/error-codes';
import { CustomersService } from '../customers/customers.service';
import { HousekeepingService } from '../housekeeping/housekeeping.service';
import { FloorsService } from '../villas/floors.service';
import { VillasService } from '../villas/villas.service';
import { ReservationConflictException } from './exceptions/reservation-conflict.exception';
import { InvalidReservationTransitionException } from './exceptions/invalid-reservation-transition.exception';
import { ReservationStaleWriteException } from './exceptions/reservation-stale-write.exception';
import { ReservationsRepository, ReservationWithRelations } from './reservations.repository';
import { ReservationsService } from './reservations.service';
import { Prisma, ReservationStatus } from '../../../generated/prisma/client';

function reservation(overrides: Partial<ReservationWithRelations> = {}): ReservationWithRelations {
  return {
    id: 'reservation-1',
    reservationNumber: 'RES-1',
    villaId: 'villa-1',
    floorId: 'floor-1',
    customerId: 'customer-1',
    checkIn: new Date('2026-01-01'),
    checkOut: new Date('2026-01-05'),
    guestCount: 2,
    totalPrice: 1000 as unknown as ReservationWithRelations['totalPrice'],
    status: ReservationStatus.CheckedIn,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    villa: { id: 'villa-1', name: 'Villa 1' },
    floor: { id: 'floor-1', name: 'Floor 1', isEntireVilla: false },
    customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
    ...overrides,
  } as ReservationWithRelations;
}

/** Stand-in for the Prisma transaction client handed to work inside the villa lock. */
const TRANSACTION_CLIENT = { transaction: 'villa-lock' };

/**
 * DomainException carries its `code` in the response body rather than on the error object,
 * so asserting on the class alone would pass for any of the codes a method can raise.
 */
async function codeOfRejection(work: Promise<unknown>): Promise<unknown> {
  try {
    await work;
  } catch (error) {
    return ((error as HttpException).getResponse() as { code: string }).code;
  }

  throw new Error('Expected the call to reject, but it resolved');
}

function rentableFloor(id: string, villaId: string, isEntireVilla = false) {
  return { id, villaId, isEntireVilla, name: id, rentable: true } as never;
}

function bookedUnit(villaId: string, floorId: string, isEntireVilla = false) {
  return { villaId, floorId, floor: { isEntireVilla } };
}

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationsRepository: jest.Mocked<ReservationsRepository>;
  let housekeepingService: jest.Mocked<HousekeepingService>;
  let villasService: jest.Mocked<VillasService>;
  let floorsService: jest.Mocked<FloorsService>;
  let customersService: jest.Mocked<CustomersService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: ReservationsRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
            updateStatusFrom: jest.fn(),
            findOverlappingUnits: jest.fn(),
            softDelete: jest.fn(),
            hasPayments: jest.fn(),
            create: jest.fn(),
            findConflicting: jest.fn(),
            findByIdempotencyKey: jest.fn(),
            // Runs the callback inline with a recognisable stand-in for the
            // transaction client, so tests can assert that the guarded work
            // really ran against it.
            withVillaLock: jest.fn((_villaId: string, work: (tx: unknown) => Promise<unknown>) =>
              work(TRANSACTION_CLIENT),
            ),
          },
        },
        { provide: VillasService, useValue: { findOneOrThrow: jest.fn() } },
        {
          provide: FloorsService,
          useValue: { findOneOrThrow: jest.fn(), findRentableFloors: jest.fn() },
        },
        { provide: CustomersService, useValue: { findOneOrThrow: jest.fn() } },
        { provide: HousekeepingService, useValue: { createForReservation: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ReservationsService);
    reservationsRepository = moduleRef.get(ReservationsRepository);
    housekeepingService = moduleRef.get(HousekeepingService);
    villasService = moduleRef.get(VillasService);
    floorsService = moduleRef.get(FloorsService);
    customersService = moduleRef.get(CustomersService);
  });

  describe('create', () => {
    const dto = {
      villaId: 'villa-1',
      floorId: 'floor-1',
      customerId: 'customer-1',
      checkIn: '2026-08-01',
      checkOut: '2026-08-05',
      guestCount: 2,
    };

    function stubHappyPath(floorOverrides: Record<string, unknown> = {}) {
      villasService.findOneOrThrow.mockResolvedValue({ id: 'villa-1' } as never);
      customersService.findOneOrThrow.mockResolvedValue({ id: 'customer-1' } as never);
      floorsService.findOneOrThrow.mockResolvedValue({
        id: 'floor-1',
        villaId: 'villa-1',
        rentable: true,
        isEntireVilla: false,
        capacity: 4,
        dailyPrice: 1000,
        ...floorOverrides,
      } as never);
    }

    it("checks for conflicts using the target floor's entire-villa flag (BR-004/005/006)", async () => {
      stubHappyPath({ isEntireVilla: true });
      reservationsRepository.findConflicting.mockResolvedValue(null);
      reservationsRepository.create.mockResolvedValue(reservation());

      await service.create(dto as never);

      expect(reservationsRepository.findConflicting).toHaveBeenCalledWith(
        expect.objectContaining({
          villaId: 'villa-1',
          floorId: 'floor-1',
          isEntireVillaFloor: true,
        }),
        expect.anything(),
      );
    });

    it('rejects the booking when a conflicting reservation exists (FR-404)', async () => {
      stubHappyPath();
      reservationsRepository.findConflicting.mockResolvedValue(
        reservation({ id: 'conflicting-1' }),
      );

      await expect(service.create(dto as never)).rejects.toThrow(ReservationConflictException);
      expect(reservationsRepository.create).not.toHaveBeenCalled();
    });

    it('creates the reservation and computes total price when there is no conflict', async () => {
      stubHappyPath({ dailyPrice: 1000 });
      reservationsRepository.findConflicting.mockResolvedValue(null);
      reservationsRepository.create.mockResolvedValue(reservation());

      await service.create(dto as never);

      expect(reservationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          villaId: 'villa-1',
          floorId: 'floor-1',
          // Decimal, not a float: 1000/night × 4 nights.
          totalPrice: new Prisma.Decimal(4000),
        }),
        expect.anything(),
      );
    });

    it('runs the conflict check and the insert inside one villa-locked transaction (FR-401/FR-402)', async () => {
      stubHappyPath();
      reservationsRepository.findConflicting.mockResolvedValue(null);
      reservationsRepository.create.mockResolvedValue(reservation());

      await service.create(dto as never);

      // Without the shared lock, a whole-villa booking and a single-floor
      // booking can both pass the check and both commit — the EXCLUDE
      // constraint only catches overlaps on the same unit.
      expect(reservationsRepository.withVillaLock).toHaveBeenCalledWith(
        'villa-1',
        expect.any(Function),
      );
      expect(reservationsRepository.findConflicting).toHaveBeenCalledWith(
        expect.anything(),
        TRANSACTION_CLIENT,
      );
      expect(reservationsRepository.create).toHaveBeenCalledWith(
        expect.anything(),
        TRANSACTION_CLIENT,
      );
    });

    it('rejects when guest count exceeds floor capacity', async () => {
      stubHappyPath({ capacity: 1 });

      await expect(service.create(dto as never)).rejects.toThrow();
      expect(reservationsRepository.findConflicting).not.toHaveBeenCalled();
    });

    it('rejects when checkOut is not after checkIn', async () => {
      stubHappyPath();

      await expect(
        service.create({ ...dto, checkIn: '2026-08-05', checkOut: '2026-08-01' } as never),
      ).rejects.toThrow();
      expect(reservationsRepository.findConflicting).not.toHaveBeenCalled();
    });

    it('returns the existing reservation when the idempotency key was already used (replayed request)', async () => {
      const existing = reservation({ id: 'reservation-existing' });
      reservationsRepository.findByIdempotencyKey.mockResolvedValue(existing);

      const result = await service.create(dto as never, 'key-1');

      expect(result).toBe(existing);
      expect(reservationsRepository.create).not.toHaveBeenCalled();
      expect(villasService.findOneOrThrow).not.toHaveBeenCalled();
    });

    it('creates a new reservation and stores the idempotency key when it has not been used before', async () => {
      stubHappyPath();
      reservationsRepository.findByIdempotencyKey.mockResolvedValue(null);
      reservationsRepository.findConflicting.mockResolvedValue(null);
      reservationsRepository.create.mockResolvedValue(reservation());

      await service.create(dto as never, 'key-1');

      expect(reservationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'key-1' }),
        expect.anything(),
      );
    });

    it('returns the winner when a concurrent replay only becomes visible inside the lock', async () => {
      const existing = reservation({ id: 'reservation-existing' });
      stubHappyPath();
      // Two replays raced: this one missed the pre-check, then queued on the villa lock while
      // the other committed. The re-check inside the lock is the one that sees the row.
      reservationsRepository.findByIdempotencyKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      const result = await service.create(dto as never, 'key-1');

      expect(result).toBe(existing);
      expect(reservationsRepository.findConflicting).not.toHaveBeenCalled();
      expect(reservationsRepository.create).not.toHaveBeenCalled();
    });

    it('re-checks the key against the transaction client, not a separate connection', async () => {
      stubHappyPath();
      reservationsRepository.findByIdempotencyKey.mockResolvedValue(null);
      reservationsRepository.findConflicting.mockResolvedValue(null);
      reservationsRepository.create.mockResolvedValue(reservation());

      await service.create(dto as never, 'key-1');

      expect(reservationsRepository.findByIdempotencyKey).toHaveBeenLastCalledWith(
        'key-1',
        TRANSACTION_CLIENT,
      );
    });
  });

  describe('update', () => {
    it('rejects with a stale-write conflict when expectedUpdatedAt does not match', async () => {
      const currentUpdatedAt = new Date('2026-08-01T10:00:00.000Z');
      reservationsRepository.findById.mockResolvedValue(
        reservation({ updatedAt: currentUpdatedAt }),
      );

      await expect(
        service.update('reservation-1', {
          notes: 'updated offline',
          expectedUpdatedAt: '2026-08-01T09:00:00.000Z',
        } as never),
      ).rejects.toThrow(ReservationStaleWriteException);
      expect(reservationsRepository.update).not.toHaveBeenCalled();
    });

    it('applies the update when expectedUpdatedAt matches the current record', async () => {
      const currentUpdatedAt = new Date('2026-08-01T10:00:00.000Z');
      reservationsRepository.findById.mockResolvedValue(
        reservation({ updatedAt: currentUpdatedAt, guestCount: 2 }),
      );
      floorsService.findOneOrThrow.mockResolvedValue({ capacity: 4 } as never);
      reservationsRepository.update.mockResolvedValue(reservation({ guestCount: 3 }));

      await service.update('reservation-1', {
        guestCount: 3,
        expectedUpdatedAt: currentUpdatedAt.toISOString(),
      } as never);

      expect(reservationsRepository.update).toHaveBeenCalledWith('reservation-1', {
        guestCount: 3,
        notes: undefined,
      });
    });

    it('applies the update when expectedUpdatedAt is omitted (no staleness check)', async () => {
      reservationsRepository.findById.mockResolvedValue(reservation({ guestCount: 2 }));
      floorsService.findOneOrThrow.mockResolvedValue({ capacity: 4 } as never);
      reservationsRepository.update.mockResolvedValue(reservation({ guestCount: 3 }));

      await service.update('reservation-1', { guestCount: 3 } as never);

      expect(reservationsRepository.update).toHaveBeenCalledWith('reservation-1', {
        guestCount: 3,
        notes: undefined,
      });
    });

    it('rejects when the updated guest count exceeds floor capacity', async () => {
      reservationsRepository.findById.mockResolvedValue(reservation({ guestCount: 2 }));
      floorsService.findOneOrThrow.mockResolvedValue({ capacity: 2 } as never);

      await expect(service.update('reservation-1', { guestCount: 5 } as never)).rejects.toThrow();
      expect(reservationsRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes a reservation that is neither in stay nor carrying payments', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.Pending }),
      );
      reservationsRepository.hasPayments.mockResolvedValue(false);

      await service.remove('reservation-1');

      expect(reservationsRepository.softDelete).toHaveBeenCalledWith('reservation-1');
    });

    it('refuses to delete a stay the guest is currently in', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.CheckedIn }),
      );

      expect(await codeOfRejection(service.remove('reservation-1'))).toBe(
        ErrorCode.RESERVATION_DELETE_IN_STAY,
      );
      expect(reservationsRepository.softDelete).not.toHaveBeenCalled();
    });

    it('refuses to delete a reservation the payments are attributed to', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.Completed }),
      );
      reservationsRepository.hasPayments.mockResolvedValue(true);

      expect(await codeOfRejection(service.remove('reservation-1'))).toBe(
        ErrorCode.RESERVATION_DELETE_HAS_PAYMENTS,
      );
      expect(reservationsRepository.softDelete).not.toHaveBeenCalled();
    });

    it('rejects an unknown reservation', async () => {
      reservationsRepository.findById.mockResolvedValue(null);

      await expect(service.remove('reservation-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAvailableFloors', () => {
    const window = { checkIn: '2026-03-01', checkOut: '2026-03-05' } as never;

    it('asks for every candidate villa in one query rather than one per floor', async () => {
      floorsService.findRentableFloors.mockResolvedValue([
        rentableFloor('floor-1', 'villa-1'),
        rentableFloor('floor-2', 'villa-1'),
        rentableFloor('floor-3', 'villa-2'),
      ]);
      reservationsRepository.findOverlappingUnits.mockResolvedValue([]);

      const result = await service.findAvailableFloors(window);

      expect(reservationsRepository.findOverlappingUnits).toHaveBeenCalledTimes(1);
      expect(reservationsRepository.findOverlappingUnits).toHaveBeenCalledWith(
        ['villa-1', 'villa-2'],
        new Date('2026-03-01'),
        new Date('2026-03-05'),
      );
      expect(result).toHaveLength(3);
    });

    it('drops a floor that is booked itself', async () => {
      floorsService.findRentableFloors.mockResolvedValue([
        rentableFloor('floor-1', 'villa-1'),
        rentableFloor('floor-2', 'villa-1'),
      ]);
      reservationsRepository.findOverlappingUnits.mockResolvedValue([
        bookedUnit('villa-1', 'floor-1'),
      ]);

      const result = await service.findAvailableFloors(window);

      expect(result.map((floor) => floor.id)).toEqual(['floor-2']);
    });

    it('drops every floor of a villa that is let out whole (FR-401)', async () => {
      floorsService.findRentableFloors.mockResolvedValue([
        rentableFloor('villa-1-whole', 'villa-1', true),
        rentableFloor('floor-1', 'villa-1'),
        rentableFloor('floor-9', 'villa-2'),
      ]);
      reservationsRepository.findOverlappingUnits.mockResolvedValue([
        bookedUnit('villa-1', 'villa-1-whole', true),
      ]);

      const result = await service.findAvailableFloors(window);

      expect(result.map((floor) => floor.id)).toEqual(['floor-9']);
    });

    it('drops the entire-villa unit when any single floor of that villa is booked (FR-402)', async () => {
      floorsService.findRentableFloors.mockResolvedValue([
        rentableFloor('villa-1-whole', 'villa-1', true),
        rentableFloor('floor-1', 'villa-1'),
        rentableFloor('floor-2', 'villa-1'),
      ]);
      reservationsRepository.findOverlappingUnits.mockResolvedValue([
        bookedUnit('villa-1', 'floor-1'),
      ]);

      const result = await service.findAvailableFloors(window);

      expect(result.map((floor) => floor.id)).toEqual(['floor-2']);
    });

    it('skips the query entirely when nothing is rentable', async () => {
      floorsService.findRentableFloors.mockResolvedValue([]);

      const result = await service.findAvailableFloors(window);

      expect(result).toEqual([]);
      expect(reservationsRepository.findOverlappingUnits).not.toHaveBeenCalled();
    });

    it('rejects a window that ends before it starts', async () => {
      await expect(
        service.findAvailableFloors({ checkIn: '2026-03-05', checkOut: '2026-03-01' } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transition', () => {
    it('auto-creates a housekeeping task when a reservation checks out (BR-008)', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.CheckedIn }),
      );
      reservationsRepository.updateStatusFrom.mockResolvedValue(
        reservation({ status: ReservationStatus.CheckedOut }),
      );

      await service.transition('reservation-1', ReservationStatus.CheckedOut);

      expect(housekeepingService.createForReservation).toHaveBeenCalledWith(
        'reservation-1',
        'villa-1',
      );
    });

    it('does not create a housekeeping task for other transitions', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.Pending }),
      );
      reservationsRepository.updateStatusFrom.mockResolvedValue(
        reservation({ status: ReservationStatus.Confirmed }),
      );

      await service.transition('reservation-1', ReservationStatus.Confirmed);

      expect(housekeepingService.createForReservation).not.toHaveBeenCalled();
    });

    it('rejects an invalid transition and does not touch housekeeping', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.Pending }),
      );

      await expect(
        service.transition('reservation-1', ReservationStatus.CheckedOut),
      ).rejects.toThrow(InvalidReservationTransitionException);
      expect(housekeepingService.createForReservation).not.toHaveBeenCalled();
    });

    it('moves the status only from the one it read, so a concurrent write cannot double-apply', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.CheckedIn }),
      );
      reservationsRepository.updateStatusFrom.mockResolvedValue(
        reservation({ status: ReservationStatus.CheckedOut }),
      );

      await service.transition('reservation-1', ReservationStatus.CheckedOut);

      expect(reservationsRepository.updateStatusFrom).toHaveBeenCalledWith(
        'reservation-1',
        ReservationStatus.CheckedIn,
        ReservationStatus.CheckedOut,
      );
    });

    it('rejects when another request already moved the row, and queues no housekeeping', async () => {
      reservationsRepository.findById.mockResolvedValue(
        reservation({ status: ReservationStatus.CheckedIn }),
      );
      // No row matched the expected status — someone else checked this stay out first.
      reservationsRepository.updateStatusFrom.mockResolvedValue(null);

      await expect(
        service.transition('reservation-1', ReservationStatus.CheckedOut),
      ).rejects.toThrow(InvalidReservationTransitionException);
      expect(housekeepingService.createForReservation).not.toHaveBeenCalled();
    });
  });
});
