import { ExpenseCategory } from './expense.model';
import { ReservationStatus } from './reservation.model';

export type PaymentMethod = 'Cash' | 'BankTransfer' | 'CreditCard';

export interface ReportQuery {
  from: string;
  to: string;
  villaId?: string;
}

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
  totalExpenses: number;
  /** Revenue minus expenses over the same window; negative is a real answer. */
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
  /** The part carried by no single villa; filtering by villa excludes it entirely. */
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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Nakit',
  BankTransfer: 'Havale/EFT',
  CreditCard: 'Kredi Kartı',
};
