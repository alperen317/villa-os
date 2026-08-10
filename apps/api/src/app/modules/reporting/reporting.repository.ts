import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  ExpenseCategory,
  PaymentMethod,
  ReservationStatus,
} from '../../../generated/prisma/client';

export interface ReportVilla {
  id: string;
  name: string;
}

export interface ReportReservation {
  id: string;
  reservationNumber: string;
  villaId: string;
  villaName: string;
  customerId: string;
  customerName: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  totalPrice: number;
  status: ReservationStatus;
}

export interface ReportPayment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  reservationNumber: string;
  villaName: string;
}

export interface ReportExpense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: Date;
  description: string;
  supplier: string | null;
  /** Null for a cost carried by the business rather than by one property. */
  villaId: string | null;
  villaName: string | null;
}

@Injectable()
export class ReportingRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActiveVillas(villaId?: string): Promise<ReportVilla[]> {
    return this.prisma.villa.findMany({
      where: { deletedAt: null, status: 'Active', ...(villaId ? { id: villaId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findReservationsOverlapping(
    from: Date,
    to: Date,
    villaId?: string,
  ): Promise<ReportReservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        deletedAt: null,
        status: { not: 'Cancelled' },
        checkIn: { lt: to },
        checkOut: { gt: from },
        ...(villaId ? { villaId } : {}),
      },
      select: {
        id: true,
        reservationNumber: true,
        villaId: true,
        checkIn: true,
        checkOut: true,
        guestCount: true,
        totalPrice: true,
        status: true,
        customerId: true,
        villa: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { checkIn: 'asc' },
    });

    return reservations.map((reservation) => ({
      id: reservation.id,
      reservationNumber: reservation.reservationNumber,
      villaId: reservation.villaId,
      villaName: reservation.villa.name,
      customerId: reservation.customerId,
      customerName: `${reservation.customer.firstName} ${reservation.customer.lastName}`,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guestCount: reservation.guestCount,
      totalPrice: Number(reservation.totalPrice),
      status: reservation.status,
    }));
  }

  async findPaymentsInRange(from: Date, to: Date, villaId?: string): Promise<ReportPayment[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        paymentDate: { gte: from, lt: to },
        ...(villaId ? { reservation: { villaId } } : {}),
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        paymentDate: true,
        reservation: { select: { reservationNumber: true, villa: { select: { name: true } } } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      reservationNumber: payment.reservation.reservationNumber,
      villaName: payment.reservation.villa.name,
    }));
  }

  /**
   * Narrowing to a villa deliberately drops the unallocated costs: an overhead like
   * accountancy belongs to the business, and charging it to whichever villa happens to be
   * on screen would be an invention. The consequence — per-villa figures not adding up to
   * the unfiltered one — is surfaced by the report rather than hidden.
   */
  async findExpensesInRange(from: Date, to: Date, villaId?: string): Promise<ReportExpense[]> {
    const expenses = await this.prisma.expense.findMany({
      where: {
        deletedAt: null,
        expenseDate: { gte: from, lt: to },
        ...(villaId ? { villaId } : {}),
      },
      select: {
        id: true,
        amount: true,
        category: true,
        expenseDate: true,
        description: true,
        supplier: true,
        villaId: true,
        villa: { select: { name: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });

    return expenses.map((expense) => ({
      id: expense.id,
      amount: Number(expense.amount),
      category: expense.category,
      expenseDate: expense.expenseDate,
      description: expense.description,
      supplier: expense.supplier,
      villaId: expense.villaId,
      villaName: expense.villa?.name ?? null,
    }));
  }
}
