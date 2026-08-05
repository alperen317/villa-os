import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';
import { Customer } from '../../../generated/prisma/client';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-1',
    firstName: 'Ali',
    lastName: 'Veli',
    phone: null,
    email: null,
    identityNumber: null,
    passportNumber: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  } as Customer;
}

describe('CustomersService', () => {
  let service: CustomersService;
  let repository: jest.Mocked<CustomersRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: CustomersRepository,
          useValue: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CustomersService);
    repository = moduleRef.get(CustomersRepository);
  });

  describe('create', () => {
    it('creates a customer profile (FR-501)', async () => {
      repository.create.mockResolvedValue(customer());

      const result = await service.create({ firstName: 'Ali', lastName: 'Veli' });

      expect(repository.create).toHaveBeenCalledWith({ firstName: 'Ali', lastName: 'Veli' });
      expect(result).toEqual(customer());
    });
  });

  describe('findAll', () => {
    it('paginates and filters by search term', async () => {
      repository.findMany.mockResolvedValue([customer()]);
      repository.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 2, limit: 10, skip: 10, search: 'Ali' } as never);

      expect(repository.findMany).toHaveBeenCalledWith({ skip: 10, take: 10, search: 'Ali' });
      expect(repository.count).toHaveBeenCalledWith({ search: 'Ali' });
      expect(result).toEqual({ data: [customer()], total: 1 });
    });
  });

  describe('findOneOrThrow', () => {
    it('returns the customer when found', async () => {
      repository.findById.mockResolvedValue(customer());

      await expect(service.findOneOrThrow('customer-1')).resolves.toEqual(customer());
    });

    it('throws NotFoundException when the customer does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates an existing customer', async () => {
      repository.findById.mockResolvedValue(customer());
      repository.update.mockResolvedValue(customer({ phone: '5551234567' }));

      const result = await service.update('customer-1', { phone: '5551234567' });

      expect(repository.update).toHaveBeenCalledWith('customer-1', { phone: '5551234567' });
      expect(result.phone).toBe('5551234567');
    });

    it('rejects updating an unknown customer', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { phone: '555' })).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing customer', async () => {
      repository.findById.mockResolvedValue(customer());

      await service.remove('customer-1');

      expect(repository.softDelete).toHaveBeenCalledWith('customer-1');
    });

    it('rejects removing an unknown customer', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
