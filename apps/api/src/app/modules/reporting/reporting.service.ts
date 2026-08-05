import { Injectable } from '@nestjs/common';
import { ReportingRepository } from './reporting.repository';
import { ReportQueryDto } from './dto/report-query.dto';
import { PaymentMethod, ReservationStatus } from '../../../generated/prisma/client';

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
  daily: RevenueReportDailyPoint[];
  byMethod: RevenueReportByMethod[];
  payments: RevenueReportPaymentRow[];
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
      const occupiedVillas = villas.filter((villa) => occupiedDatesByVilla.get(villa.id)?.has(isoDate)).length;
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

    const payments = await this.reportingRepository.findPaymentsInRange(from, to, query.villaId);

    const dailyMap = new Map<string, number>();
    const methodMap = new Map<PaymentMethod, number>();

    for (const payment of payments) {
      const isoDate = toIsoDate(toDateOnly(payment.paymentDate.toISOString()));
      dailyMap.set(isoDate, (dailyMap.get(isoDate) ?? 0) + payment.amount);
      methodMap.set(payment.paymentMethod, (methodMap.get(payment.paymentMethod) ?? 0) + payment.amount);
    }

    const daily: RevenueReportDailyPoint[] = enumerateDates(from, to).map((date) => {
      const isoDate = toIsoDate(date);
      return { date: isoDate, amount: dailyMap.get(isoDate) ?? 0 };
    });

    const byMethod: RevenueReportByMethod[] = Array.from(methodMap.entries()).map(([method, amount]) => ({
      method,
      amount,
    }));

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

    return {
      from: query.from,
      to: query.to,
      totalRevenue,
      paymentCount: payments.length,
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

  async getReservationsReport(query: ReportQueryDto): Promise<ReservationsReport> {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const reservations = await this.reportingRepository.findReservationsOverlapping(from, to, query.villaId);

    const statusMap = new Map<ReservationStatus, number>();
    let totalGuestNights = 0;
    let totalNights = 0;

    const rows: ReservationsReportRow[] = reservations.map((reservation) => {
      const clampedIn = clamp(reservation.checkIn, from, to);
      const clampedOut = clamp(reservation.checkOut, from, to);
      const nights = Math.max(0, Math.round((clampedOut.getTime() - clampedIn.getTime()) / MS_PER_DAY));

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
      averageLengthOfStay: reservations.length === 0 ? 0 : Math.round((totalNights / reservations.length) * 10) / 10,
      byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
      reservations: rows,
    };
  }

  async getCustomersReport(query: ReportQueryDto): Promise<CustomersReport> {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const reservations = await this.reportingRepository.findReservationsOverlapping(from, to, query.villaId);

    const byCustomer = new Map<string, CustomersReportRow>();
    for (const reservation of reservations) {
      const existing = byCustomer.get(reservation.customerId);
      if (existing) {
        existing.reservationCount += 1;
        existing.totalSpent += reservation.totalPrice;
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
