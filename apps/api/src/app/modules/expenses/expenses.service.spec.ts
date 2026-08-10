import { Test } from '@nestjs/testing';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { VillasService } from '../villas/villas.service';
import { ExpensesRepository, ExpenseWithRelations } from './expenses.repository';
import { ExpensesService } from './expenses.service';
import { ExpenseCategory, MaintenanceRecord, Prisma } from '../../../generated/prisma/client';
import { expectRejectionCode } from '../../common/errors/expect-error-code';
import { ErrorCode } from '../../common/errors/error-codes';

function expense(overrides: Partial<ExpenseWithRelations> = {}): ExpenseWithRelations {
  return {
    id: 'expense-1',
    villaId: null,
    maintenanceRecordId: null,
    category: ExpenseCategory.Utilities,
    description: 'Elektrik faturası',
    amount: new Prisma.Decimal('1250.50'),
    expenseDate: new Date('2026-03-10T00:00:00.000Z'),
    supplier: null,
    notes: null,
    createdAt: new Date('2026-03-10T00:00:00.000Z'),
    updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    deletedAt: null,
    villa: null,
    maintenanceRecord: null,
    ...overrides,
  } as ExpenseWithRelations;
}

function maintenanceRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'record-1',
    villaId: 'villa-1',
    title: 'Kombi arızası',
    description: null,
    priority: 'Medium',
    status: 'Open',
    openedAt: new Date('2026-03-01T00:00:00.000Z'),
    completedAt: null,
    ...overrides,
  } as MaintenanceRecord;
}

describe('ExpensesService', () => {
  let service: ExpensesService;
  let repository: jest.Mocked<ExpensesRepository>;
  let villasService: { findOneOrThrow: jest.Mock };
  let maintenanceService: { findByIdOrThrow: jest.Mock };

  beforeEach(async () => {
    villasService = { findOneOrThrow: jest.fn().mockResolvedValue({ id: 'villa-1' }) };
    maintenanceService = { findByIdOrThrow: jest.fn().mockResolvedValue(maintenanceRecord()) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: ExpensesRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(expense()),
            findById: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            sum: jest.fn().mockResolvedValue(new Prisma.Decimal(0)),
            update: jest.fn().mockResolvedValue(expense()),
            softDelete: jest.fn(),
          },
        },
        { provide: VillasService, useValue: villasService },
        { provide: MaintenanceService, useValue: maintenanceService },
      ],
    }).compile();

    service = moduleRef.get(ExpensesService);
    repository = moduleRef.get(ExpensesRepository);
  });

  const base = {
    category: ExpenseCategory.Utilities,
    description: 'Elektrik faturası',
    amount: 1250.5,
    expenseDate: '2026-03-10',
  };

  describe('create', () => {
    it('records a cost that belongs to no single property (FR-1102)', async () => {
      await service.create({ ...base });

      expect(villasService.findOneOrThrow).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ villaId: null, maintenanceRecordId: null, amount: 1250.5 }),
      );
    });

    it('turns the invoice date into the day it names, free of a time component', async () => {
      await service.create({ ...base, expenseDate: '2026-03-10' });

      const { expenseDate } = repository.create.mock.calls[0][0];
      expect((expenseDate as Date).toISOString()).toBe('2026-03-10T00:00:00.000Z');
    });

    it('refuses a villa that does not exist rather than orphaning the cost', async () => {
      villasService.findOneOrThrow.mockRejectedValue(new Error('villa gone'));

      await expect(service.create({ ...base, villaId: 'villa-9' })).rejects.toThrow('villa gone');
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('takes the villa from the maintenance record when none is given', async () => {
      // Otherwise a repair cost would sit outside the profitability of the very villa
      // whose repair it paid for.
      await service.create({ ...base, maintenanceRecordId: 'record-1' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ villaId: 'villa-1', maintenanceRecordId: 'record-1' }),
      );
    });

    it('accepts a villa that agrees with the maintenance record', async () => {
      await service.create({ ...base, villaId: 'villa-1', maintenanceRecordId: 'record-1' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ villaId: 'villa-1', maintenanceRecordId: 'record-1' }),
      );
    });

    it('refuses a villa that contradicts the maintenance record', async () => {
      // Silently preferring one side would file the cost against one villa's profit and
      // another villa's repair history — two reports that then disagree.
      await expectRejectionCode(
        service.create({ ...base, villaId: 'villa-2', maintenanceRecordId: 'record-1' }),
        ErrorCode.EXPENSE_VILLA_MISMATCH,
        409,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('sums every matching row, not just the page it returns', async () => {
      repository.findMany.mockResolvedValue([expense()]);
      repository.count.mockResolvedValue(87);
      repository.sum.mockResolvedValue(new Prisma.Decimal('43210.75'));

      const result = await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        category: ExpenseCategory.Utilities,
      } as never);

      expect(result.total).toBe(87);
      expect(result.totalAmount).toBe(43210.75);
      expect(repository.sum).toHaveBeenCalledWith(
        expect.objectContaining({ category: ExpenseCategory.Utilities }),
      );
    });

    it('reports zero for a filter that matches nothing', async () => {
      const result = await service.findAll({ page: 1, limit: 20, skip: 0 } as never);

      expect(result).toEqual({ data: [], total: 0, totalAmount: 0 });
    });
  });

  describe('findOneOrThrow', () => {
    it('does not surface an expense that was deleted', async () => {
      repository.findById.mockResolvedValue(null);

      await expectRejectionCode(
        service.findOneOrThrow('missing'),
        ErrorCode.EXPENSE_NOT_FOUND,
        404,
      );
    });
  });

  describe('update', () => {
    it('leaves both links alone when the patch touches neither', async () => {
      repository.findById.mockResolvedValue(
        expense({ villaId: 'villa-1', maintenanceRecordId: 'record-1' }),
      );

      await service.update('expense-1', { amount: 99 });

      expect(repository.update).toHaveBeenCalledWith(
        'expense-1',
        expect.objectContaining({
          villaId: 'villa-1',
          maintenanceRecordId: 'record-1',
          amount: 99,
        }),
      );
    });

    it('clears the villa when the patch sends null', async () => {
      // Distinct from omitting the field: this is how a cost wrongly tagged to a property
      // is turned back into a general one.
      repository.findById.mockResolvedValue(expense({ villaId: 'villa-1' }));

      await service.update('expense-1', { villaId: null } as never);

      expect(repository.update).toHaveBeenCalledWith(
        'expense-1',
        expect.objectContaining({ villaId: null }),
      );
    });

    it('drops the villa along with the maintenance link it was derived from', async () => {
      repository.findById.mockResolvedValue(
        expense({ villaId: 'villa-1', maintenanceRecordId: 'record-1' }),
      );

      await service.update('expense-1', { maintenanceRecordId: null } as never);

      expect(repository.update).toHaveBeenCalledWith(
        'expense-1',
        expect.objectContaining({ villaId: 'villa-1', maintenanceRecordId: null }),
      );
      expect(villasService.findOneOrThrow).toHaveBeenCalledWith('villa-1');
    });

    it('re-checks the pair when only one end moves', async () => {
      // The record stays put and the villa changes underneath it; the stored half has to
      // take part in the check or the mismatch slips through a PATCH.
      repository.findById.mockResolvedValue(
        expense({ villaId: 'villa-1', maintenanceRecordId: 'record-1' }),
      );

      await expectRejectionCode(
        service.update('expense-1', { villaId: 'villa-2' }),
        ErrorCode.EXPENSE_VILLA_MISMATCH,
        409,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects editing an expense that is gone', async () => {
      repository.findById.mockResolvedValue(null);

      await expectRejectionCode(
        service.update('missing', { amount: 5 }),
        ErrorCode.EXPENSE_NOT_FOUND,
        404,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes, so a mistyped cost leaves the reports without leaving the table', async () => {
      repository.findById.mockResolvedValue(expense());

      await service.remove('expense-1');

      expect(repository.softDelete).toHaveBeenCalledWith('expense-1');
    });

    it('rejects removing an expense that is already gone', async () => {
      repository.findById.mockResolvedValue(null);

      await expectRejectionCode(service.remove('missing'), ErrorCode.EXPENSE_NOT_FOUND, 404);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
