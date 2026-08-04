import { Test } from '@nestjs/testing';
import { InvalidHousekeepingTransitionException } from './exceptions/invalid-housekeeping-transition.exception';
import { HousekeepingRepository, HousekeepingTaskWithRelations } from './housekeeping.repository';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingStatus } from '../../../generated/prisma/client';

function task(overrides: Partial<HousekeepingTaskWithRelations> = {}): HousekeepingTaskWithRelations {
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
    reservation: { id: 'reservation-1', reservationNumber: 'RES-1' },
    assignedUser: null,
    ...overrides,
  } as HousekeepingTaskWithRelations;
}

describe('HousekeepingService', () => {
  let service: HousekeepingService;
  let repository: jest.Mocked<HousekeepingRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HousekeepingService,
        {
          provide: HousekeepingRepository,
          useValue: { create: jest.fn(), findById: jest.fn(), findMany: jest.fn(), update: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(HousekeepingService);
    repository = moduleRef.get(HousekeepingRepository);
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

  describe('start', () => {
    it('moves a Pending task to InProgress and self-assigns when unassigned', async () => {
      repository.findById.mockResolvedValue(task());
      repository.update.mockResolvedValue(task({ status: HousekeepingStatus.InProgress }));

      await service.start('task-1', 'user-1');

      expect(repository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: HousekeepingStatus.InProgress, assignedUserId: 'user-1' }),
      );
    });

    it('keeps the existing assignee when the task is already assigned', async () => {
      repository.findById.mockResolvedValue(task({ assignedUserId: 'user-original' }));
      repository.update.mockResolvedValue(task({ status: HousekeepingStatus.InProgress }));

      await service.start('task-1', 'user-2');

      expect(repository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ assignedUserId: 'user-original' }),
      );
    });

    it('rejects starting a task that is not Pending', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.Completed }));

      await expect(service.start('task-1', 'user-1')).rejects.toThrow(
        InvalidHousekeepingTransitionException,
      );
    });
  });

  describe('complete', () => {
    it('moves an InProgress task to Completed', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.InProgress }));
      repository.update.mockResolvedValue(task({ status: HousekeepingStatus.Completed }));

      await service.complete('task-1');

      expect(repository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: HousekeepingStatus.Completed }),
      );
    });

    it('rejects completing a task that is not InProgress', async () => {
      repository.findById.mockResolvedValue(task({ status: HousekeepingStatus.Pending }));

      await expect(service.complete('task-1')).rejects.toThrow(InvalidHousekeepingTransitionException);
    });
  });
});
