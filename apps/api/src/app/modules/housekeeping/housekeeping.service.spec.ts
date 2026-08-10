import { Test } from '@nestjs/testing';
import { VillasService } from '../villas/villas.service';
import { InvalidHousekeepingTransitionException } from './exceptions/invalid-housekeeping-transition.exception';
import { HousekeepingRepository, HousekeepingTaskWithRelations } from './housekeeping.repository';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingStatus } from '../../../generated/prisma/client';

function task(
  overrides: Partial<HousekeepingTaskWithRelations> = {},
): HousekeepingTaskWithRelations {
  return {
    id: 'task-1',
    reservationId: 'reservation-1',
    villaId: 'villa-1',
    assignedUserId: null,
    status: HousekeepingStatus.Pending,
    startedAt: null,
    completedAt: null,
    notes: null,
    villa: { id: 'villa-1', name: 'Villa 1' },
    reservation: {
      id: 'reservation-1',
      reservationNumber: 'RES-1',
      floor: { id: 'floor-1', name: 'Zemin Kat', isEntireVilla: false },
    },
    assignedUser: null,
    ...overrides,
  } as HousekeepingTaskWithRelations;
}

describe('HousekeepingService', () => {
  let service: HousekeepingService;
  let repository: jest.Mocked<HousekeepingRepository>;
  let villasService: jest.Mocked<VillasService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HousekeepingService,
        {
          provide: HousekeepingRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateFromStatus: jest.fn(),
          },
        },
        { provide: VillasService, useValue: { findOneOrThrow: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(HousekeepingService);
    repository = moduleRef.get(HousekeepingRepository);
    villasService = moduleRef.get(VillasService);
  });

  describe('findAll', () => {
    it('fetches active and completed tasks separately, capping completed to the most recent', async () => {
      repository.findMany
        .mockResolvedValueOnce([task()])
        .mockResolvedValueOnce([task({ status: HousekeepingStatus.Completed })]);

      await service.findAll({ villaId: 'villa-1' } as never);

      expect(repository.findMany).toHaveBeenNthCalledWith(1, {
        villaId: 'villa-1',
        statusNot: HousekeepingStatus.Completed,
      });
      expect(repository.findMany).toHaveBeenNthCalledWith(2, {
        villaId: 'villa-1',
        status: HousekeepingStatus.Completed,
        take: 50,
        orderBy: { completedAt: 'desc' },
      });
    });

    it('caps completed tasks to the most recent when explicitly filtering by Completed', async () => {
      repository.findMany.mockResolvedValue([task({ status: HousekeepingStatus.Completed })]);

      await service.findAll({ status: HousekeepingStatus.Completed } as never);

      expect(repository.findMany).toHaveBeenCalledWith({
        villaId: undefined,
        status: HousekeepingStatus.Completed,
        take: 50,
        orderBy: { completedAt: 'desc' },
      });
    });

    it('does not cap Pending/InProgress filters', async () => {
      repository.findMany.mockResolvedValue([task()]);

      await service.findAll({ status: HousekeepingStatus.Pending } as never);

      expect(repository.findMany).toHaveBeenCalledWith({
        villaId: undefined,
        status: HousekeepingStatus.Pending,
      });
    });
  });

  describe('createForReservation', () => {
    it('creates a Pending task tied to the reservation and villa (BR-008)', async () => {
      repository.create.mockResolvedValue(task());

      await service.createForReservation('reservation-1', 'villa-1');

      expect(repository.create).toHaveBeenCalledWith({
        reservationId: 'reservation-1',
        villaId: 'villa-1',
      });
    });
  });

  describe('createManual', () => {
    it('creates an ad-hoc task for a villa with no reservation', async () => {
      villasService.findOneOrThrow.mockResolvedValue({ id: 'villa-1' } as never);
      repository.create.mockResolvedValue(task({ reservationId: null, reservation: null }));

      await service.createManual({ villaId: 'villa-1', notes: 'Season prep' });

      expect(repository.create).toHaveBeenCalledWith({ villaId: 'villa-1', notes: 'Season prep' });
    });

    it('rejects an unknown villa', async () => {
      villasService.findOneOrThrow.mockRejectedValue(new Error('not found'));

      await expect(service.createManual({ villaId: 'missing' })).rejects.toThrow();
    });
  });

  describe('start', () => {
    it('moves a Pending task to InProgress and self-assigns when unassigned', async () => {
      repository.findById.mockResolvedValue(task());
      repository.updateFromStatus.mockResolvedValue(
        task({ status: HousekeepingStatus.InProgress }),
      );

      await service.start('task-1', 'user-1');

      expect(repository.updateFromStatus).toHaveBeenCalledWith(
        'task-1',
        HousekeepingStatus.Pending,
        expect.objectContaining({
          status: HousekeepingStatus.InProgress,
          assignedUserId: 'user-1',
        }),
      );
    });

    it('keeps the existing assignee when the task is already assigned', async () => {
      repository.findById.mockResolvedValue(task({ assignedUserId: 'user-original' }));
      repository.updateFromStatus.mockResolvedValue(
        task({ status: HousekeepingStatus.InProgress }),
      );

      await service.start('task-1', 'user-2');

      expect(repository.updateFromStatus).toHaveBeenCalledWith(
        'task-1',
        HousekeepingStatus.Pending,
        expect.objectContaining({ assignedUserId: 'user-original' }),
      );
    });

    it('rejects starting a task that is not Pending', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.Completed }));

      await expect(service.start('task-1', 'user-1')).rejects.toThrow(
        InvalidHousekeepingTransitionException,
      );
      expect(repository.updateFromStatus).not.toHaveBeenCalled();
    });

    it('rejects when another worker claimed the task between the read and the write', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.Pending }));
      // No row was still Pending by the time the write ran.
      repository.updateFromStatus.mockResolvedValue(null);

      await expect(service.start('task-1', 'user-1')).rejects.toThrow(
        InvalidHousekeepingTransitionException,
      );
    });
  });

  describe('complete', () => {
    it('moves an InProgress task to Completed', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.InProgress }));
      repository.updateFromStatus.mockResolvedValue(task({ status: HousekeepingStatus.Completed }));

      await service.complete('task-1');

      expect(repository.updateFromStatus).toHaveBeenCalledWith(
        'task-1',
        HousekeepingStatus.InProgress,
        expect.objectContaining({ status: HousekeepingStatus.Completed }),
      );
    });

    it('rejects completing a task that is not InProgress', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.Pending }));

      await expect(service.complete('task-1')).rejects.toThrow(
        InvalidHousekeepingTransitionException,
      );
    });

    it('rejects when the task was completed by someone else first, without overwriting completedAt', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.InProgress }));
      repository.updateFromStatus.mockResolvedValue(null);

      await expect(service.complete('task-1')).rejects.toThrow(
        InvalidHousekeepingTransitionException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
