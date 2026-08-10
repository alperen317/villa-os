import { HttpStatus, Injectable } from '@nestjs/common';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { VillasService } from '../villas/villas.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesRepository, ExpenseWithRelations } from './expenses.repository';
import { AppException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';

export interface ExpenseListResult {
  data: ExpenseWithRelations[];
  total: number;
  /** Sum over every row the filter matches, not just the page being returned. */
  totalAmount: number;
}

/** What a create or update resolves the two optional links down to. */
interface ResolvedLinks {
  villaId: string | null;
  maintenanceRecordId: string | null;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepository: ExpensesRepository,
    private readonly villasService: VillasService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  async create(dto: CreateExpenseDto): Promise<ExpenseWithRelations> {
    const links = await this.resolveLinks(dto.villaId ?? null, dto.maintenanceRecordId ?? null);

    return this.expensesRepository.create({
      ...links,
      category: dto.category,
      description: dto.description,
      amount: dto.amount,
      expenseDate: new Date(dto.expenseDate),
      supplier: dto.supplier,
      notes: dto.notes,
    });
  }

  async findAll(query: ListExpensesQueryDto): Promise<ExpenseListResult> {
    const filters = {
      villaId: query.villaId,
      category: query.category,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
    };

    const [data, total, totalAmount] = await Promise.all([
      this.expensesRepository.findMany({ ...filters, skip: query.skip, take: query.limit }),
      this.expensesRepository.count(filters),
      this.expensesRepository.sum(filters),
    ]);

    return { data, total, totalAmount: totalAmount.toNumber() };
  }

  async findOneOrThrow(id: string): Promise<ExpenseWithRelations> {
    const expense = await this.expensesRepository.findById(id);
    if (!expense) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.EXPENSE_NOT_FOUND,
        `Expense ${id} not found`,
      );
    }

    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto): Promise<ExpenseWithRelations> {
    const existing = await this.findOneOrThrow(id);

    // A PATCH may move either end of the link on its own, so the pair is re-resolved
    // against the record as it will be — not against the half of it that arrived.
    const links = await this.resolveLinks(
      dto.villaId === undefined ? existing.villaId : (dto.villaId ?? null),
      dto.maintenanceRecordId === undefined
        ? existing.maintenanceRecordId
        : (dto.maintenanceRecordId ?? null),
    );

    return this.expensesRepository.update(id, {
      ...links,
      category: dto.category,
      description: dto.description,
      amount: dto.amount,
      expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
      supplier: dto.supplier,
      notes: dto.notes,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.expensesRepository.softDelete(id);
  }

  /**
   * Both links are optional and independent, but they are not free to disagree: a
   * maintenance record belongs to exactly one villa, so an expense that cites a record
   * while naming a different villa would land in one villa's profitability and another's
   * repair history. The record wins when the villa is left blank, and a genuine mismatch
   * is refused rather than silently rewritten.
   */
  private async resolveLinks(
    villaId: string | null,
    maintenanceRecordId: string | null,
  ): Promise<ResolvedLinks> {
    if (maintenanceRecordId) {
      const record = await this.maintenanceService.findByIdOrThrow(maintenanceRecordId);

      if (villaId && villaId !== record.villaId) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.EXPENSE_VILLA_MISMATCH,
          `Maintenance record ${maintenanceRecordId} belongs to villa ${record.villaId}, not ${villaId}`,
        );
      }

      return { villaId: record.villaId, maintenanceRecordId };
    }

    if (villaId) {
      await this.villasService.findOneOrThrow(villaId);
    }

    return { villaId, maintenanceRecordId: null };
  }
}
