export type PaymentMethod = 'Cash' | 'BankTransfer' | 'CreditCard';

export interface Payment {
  id: string;
  reservationId: string;
  amount: string;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber: string | null;
  notes: string | null;
}

export interface PaymentsSummary {
  reservationId: string;
  totalPrice: number;
  totalPaid: number;
  outstandingBalance: number;
  payments: Payment[];
}

export interface CreatePaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  referenceNumber?: string;
  notes?: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Nakit',
  BankTransfer: 'Havale/EFT',
  CreditCard: 'Kredi Kartı',
};
