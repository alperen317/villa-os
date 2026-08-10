import { Test } from '@nestjs/testing';
import { VillasService } from '../villas/villas.service';
import { InvalidMaintenanceTransitionException } from './exceptions/invalid-maintenance-transition.exception';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';
import {
  MaintenancePriority,
  MaintenanceRecord,
  MaintenanceStatus,
} from '../../../generated/prisma/client';

function record(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'record-1',
    villaId: 'villa-1',
    title: 'AC servicing',
    description: null,
    priority: MaintenancePriority.Medium,
    status: MaintenanceStatus.Open,
    openedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let repository: jest.Mocked<MaintenanceRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: MaintenanceRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findManyByVilla: jest.fn(),
            update: jest.fn(),
            updateFromStatus: jest.fn(),
          },
        },
        { provide: VillasService, useValue: { findOneOrThrow: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(MaintenanceService);
    repository = moduleRef.get(MaintenanceRepository);
  });

  describe('start', () => {
    it('moves an Open record to InProgress', async () => {
      repository.findById.mockResolvedValue(record());
      repository.updateFromStatus.mockResolvedValue(
        record({ status: MaintenanceStatus.InProgress }),
      );

      await service.start('villa-1', 'record-1');

      expect(repository.updateFromStatus).toHaveBeenCalledWith(
        'record-1',
        MaintenanceStatus.Open,
        expect.objectContaining({ status: MaintenanceStatus.InProgress }),
      );
    });

    it('rejects starting a record that is not Open', async () => {
      repository.findById.mockResolvedValue(record({ status: MaintenanceStatus.Completed }));

      await expect(service.start('villa-1', 'record-1')).rejects.toThrow(
        InvalidMaintenanceTransitionException,
      );
      expect(repository.updateFromStatus).not.toHaveBeenCalled();
    });

    it('rejects when the record was started by someone else between the read and the write', async () => {
      repository.findById.mockResolvedValue(record({ status: MaintenanceStatus.Open }));
      repository.updateFromStatus.mockResolvedValue(null);

      await expect(service.start('villa-1', 'record-1')).rejects.toThrow(
        InvalidMaintenanceTransitionException,
      );
    });
  });

  describe('complete', () => {
    it('moves an InProgress record to Completed and stamps completedAt', async () => {
      repository.findById.mockResolvedValue(record({ status: MaintenanceStatus.InProgress }));
      repository.updateFromStatus.mockResolvedValue(
        record({ status: MaintenanceStatus.Completed }),
      );

      await service.complete('villa-1', 'record-1');

      expect(repository.updateFromStatus).toHaveBeenCalledWith(
        'record-1',
        MaintenanceStatus.InProgress,
        expect.objectContaining({
          status: MaintenanceStatus.Completed,
          completedAt: expect.any(Date),
        }),
      );
    });

    it('rejects completing a record that is not InProgress', async () => {
      repository.findById.mockResolvedValue(record({ status: MaintenanceStatus.Open }));

      await expect(service.complete('villa-1', 'record-1')).rejects.toThrow(
        InvalidMaintenanceTransitionException,
      );
    });

    it('rejects when the record was completed first elsewhere, leaving completedAt untouched', async () => {
      repository.findById.mockResolvedValue(record({ status: MaintenanceStatus.InProgress }));
      repository.updateFromStatus.mockResolvedValue(null);

      await expect(service.complete('villa-1', 'record-1')).rejects.toThrow(
        InvalidMaintenanceTransitionException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('findOneOrThrow', () => {
    it('rejects a record that belongs to a different villa', async () => {
      repository.findById.mockResolvedValue(record({ villaId: 'villa-other' }));

      await expect(service.findOneOrThrow('villa-1', 'record-1')).rejects.toThrow();
    });
  });
});
