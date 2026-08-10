import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  countArrivalsToday(today: Date): Promise<number> {
    return this.prisma.reservation.count({
      where: { deletedAt: null, checkIn: startOfDay(today), status: { not: 'Cancelled' } },
    });
  }

  countDeparturesToday(today: Date): Promise<number> {
    return this.prisma.reservation.count({
      where: { deletedAt: null, checkOut: startOfDay(today), status: { not: 'Cancelled' } },
    });
  }

  async sumCurrentGuests(): Promise<number> {
    const result = await this.prisma.reservation.aggregate({
      where: { deletedAt: null, status: 'CheckedIn' },
      _sum: { guestCount: true },
    });

    return result._sum.guestCount ?? 0;
  }

  async countOccupiedVillas(): Promise<number> {
    const rows = await this.prisma.reservation.findMany({
      where: { deletedAt: null, status: 'CheckedIn' },
      select: { villaId: true },
      distinct: ['villaId'],
    });

    return rows.length;
  }

  countActiveVillas(): Promise<number> {
    return this.prisma.villa.count({ where: { deletedAt: null, status: 'Active' } });
  }

  async sumRevenueThisMonth(monthStart: Date, monthEnd: Date): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: { paymentDate: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }

  /**
   * `expenseDate` is a date column, so the month bounds compare cleanly against it; the
   * soft-delete filter is what keeps a corrected entry out of the figure.
   */
  async sumExpensesThisMonth(monthStart: Date, monthEnd: Date): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      where: { deletedAt: null, expenseDate: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }

  countOpenHousekeepingTasks(): Promise<number> {
    return this.prisma.housekeepingTask.count({ where: { status: { not: 'Completed' } } });
  }

  countOpenMaintenanceRecords(): Promise<number> {
    return this.prisma.maintenanceRecord.count({ where: { status: { not: 'Completed' } } });
  }
}
