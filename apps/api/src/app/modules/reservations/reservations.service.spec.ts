import { Test } from '@nestjs/testing';
import { CustomersService } from '../customers/customers.service';
import { HousekeepingService } from '../housekeeping/housekeeping.service';
import { FloorsService } from '../villas/floors.service';
import { VillasService } from '../villas/villas.service';
import { ReservationConflictException } from './exceptions/reservation-conflict.exception';
import { InvalidReservationTransitionException } from './exceptions/invalid-reservation-transition.exception';
import { ReservationsRepository, ReservationWithRelations } from './reservations.repository';
import { ReservationsService } from './reservations.service';
import { ReservationStatus } from '../../../generated/prisma/client';

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
          useValue: { findById: jest.fn(), update: jest.fn(), create: jest.fn(), findConflicting: jest.fn() },
        },
        { provide: VillasService, useValue: { findOneOrThrow: jest.fn() } },
        { provide: FloorsService, useValue: { findOneOrThrow: jest.fn() } },
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

    it('checks for conflicts using the target floor\'s entire-villa flag (BR-004/005/006)', async () => {
      stubHappyPath({ isEntireVilla: true });
      reservationsRepository.findConflicting.mockResolvedValue(null);
      reservationsRepository.create.mockResolvedValue(reservation());

      await service.create(dto as never);

      expect(reservationsRepository.findConflicting).toHaveBeenCalledWith(
        expect.objectContaining({ villaId: 'villa-1', floorId: 'floor-1', isEntireVillaFloor: true }),
      );
    });

    it('rejects the booking when a conflicting reservation exists (FR-404)', async () => {
      stubHappyPath();
      reservationsRepository.findConflicting.mockResolvedValue(reservation({ id: 'conflicting-1' }));

      await expect(service.create(dto as never)).rejects.toThrow(ReservationConflictException);
      expect(reservationsRepository.create).not.toHaveBeenCalled();
    });

    it('creates the reservation and computes total price when there is no conflict', async () => {
      stubHappyPath({ dailyPrice: 1000 });
      reservationsRepository.findConflicting.mockResolvedValue(null);
      reservationsRepository.create.mockResolvedValue(reservation());

      await service.create(dto as never);

      expect(reservationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ villaId: 'villa-1', floorId: 'floor-1', totalPrice: 4000 }),
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
  });

  describe('transition', () => {
    it('auto-creates a housekeeping task when a reservation checks out (BR-008)', async () => {
      reservationsRepository.findById.mockResolvedValue(reservation({ status: ReservationStatus.CheckedIn }));
      reservationsRepository.update.mockResolvedValue(
        reservation({ status: ReservationStatus.CheckedOut }),
      );

      await service.transition('reservation-1', ReservationStatus.CheckedOut);

      expect(housekeepingService.createForReservation).toHaveBeenCalledWith('reservation-1', 'villa-1');
    });

    it('does not create a housekeeping task for other transitions', async () => {
      reservationsRepository.findById.mockResolvedValue(reservation({ status: ReservationStatus.Pending }));
      reservationsRepository.update.mockResolvedValue(
        reservation({ status: ReservationStatus.Confirmed }),
      );

      await service.transition('reservation-1', ReservationStatus.Confirmed);

      expect(housekeepingService.createForReservation).not.toHaveBeenCalled();
    });

    it('rejects an invalid transition and does not touch housekeeping', async () => {
      reservationsRepository.findById.mockResolvedValue(reservation({ status: ReservationStatus.Pending }));

      await expect(service.transition('reservation-1', ReservationStatus.CheckedOut)).rejects.toThrow(
        InvalidReservationTransitionException,
      );
      expect(housekeepingService.createForReservation).not.toHaveBeenCalled();
    });
  });
});
