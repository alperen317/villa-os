import { Injectable } from '@nestjs/common';
import { addMoney, subtractMoney, sumMoney } from '../../common/money';
import { ReportingRepository } from './reporting.repository';
import { ReportQueryDto } from './dto/report-query.dto';
import {
  ExpenseCategory,
  PaymentMethod,
  ReservationStatus,
} from '../../../generated/prisma/client';

export interface OccupancyReportVilla {
  villaId: string;
  villaName: string;
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number;
}

export interface OccupancyReportDailyPoint {
  date: string;
  occupiedVillas: number;
  totalVillas: number;
  occupancyRate: number;
}

export interface OccupancyReport {
  from: string;
  to: string;
  totalOccupiedNights: number;
  totalAvailableNights: number;
  overallOccupancyRate: number;
  villas: OccupancyReportVilla[];
  daily: OccupancyReportDailyPoint[];
}

export interface RevenueReportDailyPoint {
  date: string;
  amount: number;
}

export interface RevenueReportByMethod {
  method: PaymentMethod;
  amount: number;
}

export interface RevenueReportPaymentRow {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reservationNumber: string;
  villaName: string;
}

export interface RevenueReport {
  from: string;
  to: string;
  totalRevenue: number;
  paymentCount: number;
  /** Expenses over the same window, so the two sides are always read together. */
  totalExpenses: number;
  netProfit: number;
  daily: RevenueReportDailyPoint[];
  byMethod: RevenueReportByMethod[];
  payments: RevenueReportPaymentRow[];
}

export interface ExpensesReportByCategory {
  category: ExpenseCategory;
  amount: number;
  count: number;
}

export interface ExpensesReportDailyPoint {
  date: string;
  amount: number;
}

export interface ExpensesReportByVilla {
  villaId: string | null;
  villaName: string | null;
  amount: number;
}

export interface ExpensesReportRow {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  supplier: string | null;
  villaName: string | null;
  amount: number;
}

export interface ExpensesReport {
  from: string;
  to: string;
  totalExpenses: number;
  expenseCount: number;
  /**
   * The part of `totalExpenses` carried by no single villa. Filtering the report by villa
   * excludes these entirely, which is why per-villa totals do not add up to the whole.
   */
  unallocatedExpenses: number;
  byCategory: ExpensesReportByCategory[];
  byVilla: ExpensesReportByVilla[];
  daily: ExpensesReportDailyPoint[];
  expenses: ExpensesReportRow[];
}

export interface ReservationsReportByStatus {
  status: ReservationStatus;
  count: number;
}

export interface ReservationsReportRow {
  id: string;
  reservationNumber: string;
  villaName: string;
  customerName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  totalPrice: number;
  status: ReservationStatus;
}

export interface ReservationsReport {
  from: string;
  to: string;
  totalReservations: number;
  totalGuestNights: number;
  averageLengthOfStay: number;
  byStatus: ReservationsReportByStatus[];
  reservations: ReservationsReportRow[];
}

export interface CustomersReportRow {
  customerId: string;
  customerName: string;
  reservationCount: number;
  totalSpent: number;
  lastCheckIn: string;
}

export interface CustomersReport {
  from: string;
  to: string;
  totalCustomers: number;
  customers: CustomersReportRow[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateOnly(value: string): Date {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function clamp(date: Date, min: Date, max: Date): Date {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function enumerateDates(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  for (let cursor = from; cursor < to; cursor = new Date(cursor.getTime() + MS_PER_DAY)) {
    dates.push(cursor);
  }
  return dates;
}

@Injectable()
export class ReportingService {
  constructor(private readonly reportingRepository: ReportingRepository) {}

  async getOccupancyReport(query: ReportQueryDto): Promise<OccupancyReport> {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const [villas, reservations] = await Promise.all([
      this.reportingRepository.listActiveVillas(query.villaId),
      this.reportingRepository.findReservationsOverlapping(from, to, query.villaId),
    ]);

    const occupiedDatesByVilla = new Map<string, Set<string>>();
    for (const villa of villas) {
      occupiedDatesByVilla.set(villa.id, new Set());
    }

    for (const reservation of reservations) {
      const set = occupiedDatesByVilla.get(reservation.villaId);
      if (!set) continue;

      const clampedIn = clamp(reservation.checkIn, from, to);
      const clampedOut = clamp(reservation.checkOut, from, to);
      for (const date of enumerateDates(clampedIn, clampedOut)) {
        set.add(toIsoDate(date));
      }
    }

    const totalDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY));

    const villaReports: OccupancyReportVilla[] = villas.map((villa) => {
      const occupiedNights = occupiedDatesByVilla.get(villa.id)?.size ?? 0;
      return {
        villaId: villa.id,
        villaName: villa.name,
        occupiedNights,
        availableNights: totalDays,
        occupancyRate: this.rate(occupiedNights, totalDays),
      };
    });

    const daily: OccupancyReportDailyPoint[] = enumerateDates(from, to).map((date) => {
      const isoDate = toIsoDate(date);
      const occupiedVillas = villas.filter((villa) =>
        occupiedDatesByVilla.get(villa.id)?.has(isoDate),
      ).length;
      return {
        date: isoDate,
        occupiedVillas,
        totalVillas: villas.length,
        occupancyRate: this.rate(occupiedVillas, villas.length),
      };
    });

    const totalOccupiedNights = villaReports.reduce((sum, villa) => sum + villa.occupiedNights, 0);
    const totalAvailableNights = totalDays * villas.length;

    return {
      from: query.from,
      to: query.to,
      totalOccupiedNights,
      totalAvailableNights,
      overallOccupancyRate: this.rate(totalOccupiedNights, totalAvailableNights),
      villas: villaReports,
      daily,
    };
  }

  async getRevenueReport(query: ReportQueryDto): Promise<RevenueReport> {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const [payments, expenses] = await Promise.all([
      this.reportingRepository.findPaymentsInRange(from, to, query.villaId),
      this.reportingRepository.findExpensesInRange(from, to, query.villaId),
    ]);

    const dailyMap = new Map<string, number>();
    const methodMap = new Map<PaymentMethod, number>();

    for (const payment of payments) {
      const isoDate = toIsoDate(toDateOnly(payment.paymentDate.toISOString()));
      dailyMap.set(isoDate, addMoney(dailyMap.get(isoDate) ?? 0, payment.amount));
      methodMap.set(
        payment.paymentMethod,
        addMoney(methodMap.get(payment.paymentMethod) ?? 0, payment.amount),
      );
    }

    const daily: RevenueReportDailyPoint[] = enumerateDates(from, to).map((date) => {
      const isoDate = toIsoDate(date);
      return { date: isoDate, amount: dailyMap.get(isoDate) ?? 0 };
    });

    const byMethod: RevenueReportByMethod[] = Array.from(methodMap.entries()).map(
      ([method, amount]) => ({
        method,
        amount,
      }),
    );

    const totalRevenue = sumMoney(payments.map((payment) => payment.amount));
    const totalExpenses = sumMoney(expenses.map((expense) => expense.amount));

    return {
      from: query.from,
      to: query.to,
      totalRevenue,
      paymentCount: payments.length,
      totalExpenses,
      // Can be negative — a quiet month with a new boiler in it, which is a fact worth
      // showing rather than clamping to zero.
      netProfit: subtractMoney(totalRevenue, totalExpenses),
      daily,
      byMethod,
      payments: payments.map((payment) => ({
        id: payment.id,
        paymentDate: payment.paymentDate.toISOString(),
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        reservationNumber: payment.reservationNumber,
        villaName: payment.villaName,
      })),
    };
  }

  async getExpensesReport(query: ReportQueryDto): Promise<ExpensesReport> {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const expenses = await this.reportingRepository.findExpensesInRange(from, to, query.villaId);

    const categoryAmounts = new Map<ExpenseCategory, number>();
    const categoryCounts = new Map<ExpenseCategory, number>();
    const dailyMap = new Map<string, number>();
    const villaAmounts = new Map<string | null, { name: string | null; amount: number }>();

    for (const expense of expenses) {
      categoryAmounts.set(
        expense.category,
        addMoney(categoryAmounts.get(expense.category) ?? 0, expense.amount),
      );
      categoryCounts.set(expense.category, (categoryCounts.get(expense.category) ?? 0) + 1);

      const isoDate = toIsoDate(toDateOnly(expense.expenseDate.toISOString()));
      dailyMap.set(isoDate, addMoney(dailyMap.get(isoDate) ?? 0, expense.amount));

      const villa = villaAmounts.get(expense.villaId) ?? { name: expense.villaName, amount: 0 };
      villa.amount = addMoney(villa.amount, expense.amount);
      villaAmounts.set(expense.villaId, villa);
    }

    const byCategory: ExpensesReportByCategory[] = Array.from(categoryAmounts.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        count: categoryCounts.get(category) ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const byVilla: ExpensesReportByVilla[] = Array.from(villaAmounts.entries())
      .map(([villaId, villa]) => ({ villaId, villaName: villa.name, amount: villa.amount }))
      .sort((a, b) => b.amount - a.amount);

    const daily: ExpensesReportDailyPoint[] = enumerateDates(from, to).map((date) => {
      const isoDate = toIsoDate(date);
      return { date: isoDate, amount: dailyMap.get(isoDate) ?? 0 };
    });

    return {
      from: query.from,
      to: query.to,
      totalExpenses: sumMoney(expenses.map((expense) => expense.amount)),
      expenseCount: expenses.length,
      unallocatedExpenses: sumMoney(
        expenses.filter((expense) => expense.villaId === null).map((expense) => expense.amount),
      ),
      byCategory,
      byVilla,
      daily,
      expenses: expenses.map((expense) => ({
        id: expense.id,
        expenseDate: toIsoDate(expense.expenseDate),
        category: expense.category,
        description: expense.description,
        supplier: expense.supplier,
        villaName: expense.villaName,
        amount: expense.amount,
      })),
    };
  }

  async getReservationsReport(query: ReportQueryDto): Promise<ReservationsReport> {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const reservations = await this.reportingRepository.findReservationsOverlapping(
      from,
      to,
      query.villaId,
    );

    const statusMap = new Map<ReservationStatus, number>();
    let totalGuestNights = 0;
    let totalNights = 0;

    const rows: ReservationsReportRow[] = reservations.map((reservation) => {
      const clampedIn = clamp(reservation.checkIn, from, to);
      const clampedOut = clamp(reservation.checkOut, from, to);
      const nights = Math.max(
        0,
        Math.round((clampedOut.getTime() - clampedIn.getTime()) / MS_PER_DAY),
      );

      statusMap.set(reservation.status, (statusMap.get(reservation.status) ?? 0) + 1);
      totalGuestNights += nights * reservation.guestCount;
      totalNights += nights;

      return {
        id: reservation.id,
        reservationNumber: reservation.reservationNumber,
        villaName: reservation.villaName,
        customerName: reservation.customerName,
        checkIn: toIsoDate(reservation.checkIn),
        checkOut: toIsoDate(reservation.checkOut),
        nights,
        guestCount: reservation.guestCount,
        totalPrice: reservation.totalPrice,
        status: reservation.status,
      };
    });

    return {
      from: query.from,
      to: query.to,
      totalReservations: reservations.length,
      totalGuestNights,
      averageLengthOfStay:
        reservations.length === 0 ? 0 : Math.round((totalNights / reservations.length) * 10) / 10,
      byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
      reservations: rows,
    };
  }

  async getCustomersReport(query: ReportQueryDto): Promise<CustomersReport> {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const reservations = await this.reportingRepository.findReservationsOverlapping(
      from,
      to,
      query.villaId,
    );

    const byCustomer = new Map<string, CustomersReportRow>();
    for (const reservation of reservations) {
      const existing = byCustomer.get(reservation.customerId);
      if (existing) {
        existing.reservationCount += 1;
        existing.totalSpent = addMoney(existing.totalSpent, reservation.totalPrice);
        if (reservation.checkIn.toISOString() > existing.lastCheckIn) {
          existing.lastCheckIn = toIsoDate(reservation.checkIn);
        }
      } else {
        byCustomer.set(reservation.customerId, {
          customerId: reservation.customerId,
          customerName: reservation.customerName,
          reservationCount: 1,
          totalSpent: reservation.totalPrice,
          lastCheckIn: toIsoDate(reservation.checkIn),
        });
      }
    }

    const customers = Array.from(byCustomer.values()).sort((a, b) => b.totalSpent - a.totalSpent);

    return {
      from: query.from,
      to: query.to,
      totalCustomers: customers.length,
      customers,
    };
  }

  private rate(part: number, whole: number): number {
    if (whole === 0) return 0;
    return Math.round((part / whole) * 1000) / 10;
  }
}
