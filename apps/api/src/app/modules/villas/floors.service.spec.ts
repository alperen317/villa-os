import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FloorsRepository } from './floors.repository';
import { FloorsService } from './floors.service';
import { VillasService } from './villas.service';
import { Floor } from '../../../generated/prisma/client';

function floor(overrides: Partial<Floor> = {}): Floor {
  return {
    id: 'floor-1',
    villaId: 'villa-1',
    name: 'Zemin Kat',
    capacity: 4,
    bedrooms: 2,
    bathrooms: 1,
    dailyPrice: 1000 as never,
    rentable: true,
    isEntireVilla: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Floor;
}

describe('FloorsService', () => {
  let service: FloorsService;
  let repository: jest.Mocked<FloorsRepository>;
  let villasService: jest.Mocked<VillasService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FloorsService,
        {
          provide: FloorsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findManyByVilla: jest.fn(),
            findRentable: jest.fn(),
            findEntireVillaFloor: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        { provide: VillasService, useValue: { findOneOrThrow: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(FloorsService);
    repository = moduleRef.get(FloorsRepository);
    villasService = moduleRef.get(VillasService);
  });

  describe('create', () => {
    it('creates a regular floor under an existing villa (FR-104/201/202)', async () => {
      villasService.findOneOrThrow.mockResolvedValue({ id: 'villa-1' } as never);
      repository.create.mockResolvedValue(floor());

      await service.create('villa-1', { name: 'Zemin Kat', capacity: 4 } as never);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ villaId: 'villa-1', name: 'Zemin Kat' }),
      );
    });

    it('rejects creating a floor under an unknown villa', async () => {
      villasService.findOneOrThrow.mockRejectedValue(new NotFoundException());

      await expect(service.create('missing', { name: 'X' } as never)).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('allows creating the first entire-villa floor', async () => {
      villasService.findOneOrThrow.mockResolvedValue({ id: 'villa-1' } as never);
      repository.findEntireVillaFloor.mockResolvedValue(null);
      repository.create.mockResolvedValue(floor({ isEntireVilla: true }));

      await service.create('villa-1', { name: 'Tüm Villa', isEntireVilla: true } as never);

      expect(repository.create).toHaveBeenCalled();
    });

    it('rejects a second entire-villa floor for the same villa', async () => {
      villasService.findOneOrThrow.mockResolvedValue({ id: 'villa-1' } as never);
      repository.findEntireVillaFloor.mockResolvedValue(floor({ id: 'floor-existing', isEntireVilla: true }));

      await expect(
        service.create('villa-1', { name: 'Tüm Villa 2', isEntireVilla: true } as never),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOneOrThrow', () => {
    it('throws when the floor belongs to a different villa', async () => {
      repository.findById.mockResolvedValue(floor({ villaId: 'other-villa' }));

      await expect(service.findOneOrThrow('villa-1', 'floor-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when the floor does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOneOrThrow('villa-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('allows re-saving an existing entire-villa floor without conflict', async () => {
      repository.findById.mockResolvedValue(floor({ isEntireVilla: true }));
      repository.update.mockResolvedValue(floor({ isEntireVilla: true, dailyPrice: 2000 as never }));

      await service.update('villa-1', 'floor-1', { isEntireVilla: true, dailyPrice: 2000 } as never);

      expect(repository.findEntireVillaFloor).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalled();
    });

    it('rejects flipping a regular floor to entire-villa when one already exists', async () => {
      repository.findById.mockResolvedValue(floor({ isEntireVilla: false }));
      repository.findEntireVillaFloor.mockResolvedValue(floor({ id: 'floor-other', isEntireVilla: true }));

      await expect(
        service.update('villa-1', 'floor-1', { isEntireVilla: true } as never),
      ).rejects.toThrow(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing floor', async () => {
      repository.findById.mockResolvedValue(floor());

      await service.remove('villa-1', 'floor-1');

      expect(repository.softDelete).toHaveBeenCalledWith('floor-1');
    });
  });
});
