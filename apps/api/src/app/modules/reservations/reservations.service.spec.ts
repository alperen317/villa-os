import { Test } from '@nestjs/testing';
import { CustomersService } from '../customers/customers.service';
import { HousekeepingService } from '../housekeeping/housekeeping.service';
import { FloorsService } from '../villas/floors.service';
import { VillasService } from '../villas/villas.service';
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

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: ReservationsRepository,
          useValue: { findById: jest.fn(), update: jest.fn() },
        },
        { provide: VillasService, useValue: {} },
        { provide: FloorsService, useValue: {} },
        { provide: CustomersService, useValue: {} },
        { provide: HousekeepingService, useValue: { createForReservation: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ReservationsService);
    reservationsRepository = moduleRef.get(ReservationsRepository);
    housekeepingService = moduleRef.get(HousekeepingService);
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
