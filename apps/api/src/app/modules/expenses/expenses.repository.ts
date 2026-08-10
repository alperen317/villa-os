import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Expense, ExpenseCategory, Prisma } from '../../../generated/prisma/client';

const EXPENSE_WITH_RELATIONS_INCLUDE = {
  villa: { select: { id: true, name: true } },
  maintenanceRecord: { select: { id: true, title: true } },
} satisfies Prisma.ExpenseInclude;

export type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof EXPENSE_WITH_RELATIONS_INCLUDE;
}>;

export interface ExpenseFilters {
  villaId?: string;
  category?: ExpenseCategory;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ExpenseUncheckedCreateInput): Promise<ExpenseWithRelations> {
    return this.prisma.expense.create({ data, include: EXPENSE_WITH_RELATIONS_INCLUDE });
  }

  findById(id: string): Promise<ExpenseWithRelations | null> {
    return this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: EXPENSE_WITH_RELATIONS_INCLUDE,
    });
  }

  findMany(
    params: ExpenseFilters & { skip: number; take: number },
  ): Promise<ExpenseWithRelations[]> {
    return this.prisma.expense.findMany({
      where: this.buildWhere(params),
      include: EXPENSE_WITH_RELATIONS_INCLUDE,
      // Two expenses commonly share a date — the invoices arrive in a batch — so the
      // second key keeps paging stable instead of letting equal rows swap between pages.
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: params.skip,
      take: params.take,
    });
  }

  count(params: ExpenseFilters): Promise<number> {
    return this.prisma.expense.count({ where: this.buildWhere(params) });
  }

  /** The filtered total, which is what the list header reports — not just the page's. */
  async sum(params: ExpenseFilters): Promise<Prisma.Decimal> {
    const result = await this.prisma.expense.aggregate({
      where: this.buildWhere(params),
      _sum: { amount: true },
    });

    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  update(id: string, data: Prisma.ExpenseUncheckedUpdateInput): Promise<ExpenseWithRelations> {
    return this.prisma.expense.update({
      where: { id },
      data,
      include: EXPENSE_WITH_RELATIONS_INCLUDE,
    });
  }

  softDelete(id: string): Promise<Expense> {
    return this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private buildWhere(params: ExpenseFilters): Prisma.ExpenseWhereInput {
    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      villaId: params.villaId,
      category: params.category,
    };

    // Both bounds are inclusive, so `dateTo` becomes an exclusive `lt` on the next day —
    // the same reading `reservations` uses for its list filter.
    const expenseDate: Prisma.DateTimeFilter = {};
    if (params.dateFrom) {
      expenseDate.gte = new Date(params.dateFrom);
    }
    if (params.dateTo) {
      const exclusiveEnd = new Date(params.dateTo);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      expenseDate.lt = exclusiveEnd;
    }
    if (params.dateFrom || params.dateTo) {
      where.expenseDate = expenseDate;
    }

    if (params.search?.trim()) {
      const term = params.search.trim();
      where.OR = [
        { description: { contains: term, mode: 'insensitive' } },
        { supplier: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
