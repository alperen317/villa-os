import { expectRejectionCode } from '../../common/errors/expect-error-code';
import { ErrorCode } from '../../common/errors/error-codes';
import { Test } from '@nestjs/testing';
import { VillasRepository } from './villas.repository';
import { VillasService } from './villas.service';
import { Villa } from '../../../generated/prisma/client';

function villa(overrides: Partial<Villa> = {}): Villa {
  return {
    id: 'villa-1',
    name: 'Bodrum Villa',
    description: null,
    address: null,
    latitude: null,
    longitude: null,
    status: 'Active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  } as Villa;
}

describe('VillasService', () => {
  let service: VillasService;
  let repository: jest.Mocked<VillasRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VillasService,
        {
          provide: VillasRepository,
          useValue: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findVillaIdsWithOpenMaintenance: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(VillasService);
    repository = moduleRef.get(VillasRepository);
  });

  describe('create', () => {
    it('creates a villa (FR-101)', async () => {
      repository.create.mockResolvedValue(villa());

      await expect(service.create({ name: 'Bodrum Villa' } as never)).resolves.toEqual(villa());
      expect(repository.create).toHaveBeenCalledWith({ name: 'Bodrum Villa' });
    });
  });

  describe('findAll', () => {
    it('flags villas that have open maintenance records', async () => {
      repository.findMany.mockResolvedValue([villa({ id: 'villa-1' }), villa({ id: 'villa-2' })]);
      repository.count.mockResolvedValue(2);
      repository.findVillaIdsWithOpenMaintenance.mockResolvedValue(new Set(['villa-2']));

      const result = await service.findAll({ skip: 0, limit: 20 } as never);

      expect(result.data).toEqual([
        expect.objectContaining({ id: 'villa-1', hasOpenMaintenance: false }),
        expect.objectContaining({ id: 'villa-2', hasOpenMaintenance: true }),
      ]);
      expect(result.total).toBe(2);
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException for an unknown villa', async () => {
      repository.findById.mockResolvedValue(null);

      await expectRejectionCode(service.findOneOrThrow('missing'), ErrorCode.VILLA_NOT_FOUND, 404);
    });
  });

  describe('setStatus', () => {
    it('activates a villa (FR-103)', async () => {
      repository.findById.mockResolvedValue(villa({ status: 'Inactive' }));
      repository.update.mockResolvedValue(villa({ status: 'Active' }));

      const result = await service.setStatus('villa-1', 'Active');

      expect(repository.update).toHaveBeenCalledWith('villa-1', { status: 'Active' });
      expect(result.status).toBe('Active');
    });

    it('deactivates a villa (FR-103)', async () => {
      repository.findById.mockResolvedValue(villa({ status: 'Active' }));
      repository.update.mockResolvedValue(villa({ status: 'Inactive' }));

      const result = await service.setStatus('villa-1', 'Inactive');

      expect(repository.update).toHaveBeenCalledWith('villa-1', { status: 'Inactive' });
      expect(result.status).toBe('Inactive');
    });

    it('rejects setting status on an unknown villa', async () => {
      repository.findById.mockResolvedValue(null);

      await expectRejectionCode(
        service.setStatus('missing', 'Inactive'),
        ErrorCode.VILLA_NOT_FOUND,
        404,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing villa', async () => {
      repository.findById.mockResolvedValue(villa());

      await service.remove('villa-1');

      expect(repository.softDelete).toHaveBeenCalledWith('villa-1');
    });

    it('rejects removing an unknown villa', async () => {
      repository.findById.mockResolvedValue(null);

      await expectRejectionCode(service.remove('missing'), ErrorCode.VILLA_NOT_FOUND, 404);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
