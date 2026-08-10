import { PagedResult } from './paged-result.model';

export type ExpenseCategory =
  'Utilities' | 'Cleaning' | 'Maintenance' | 'Staff' | 'Supplies' | 'Tax' | 'Other';

export interface Expense {
  id: string;
  /** Null for a cost the business carries rather than one property. */
  villaId: string | null;
  maintenanceRecordId: string | null;
  category: ExpenseCategory;
  description: string;
  /** Decimal(10,2) — arrives as a string so the cents survive the trip. */
  amount: string;
  expenseDate: string;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  villa: { id: string; name: string } | null;
  maintenanceRecord: { id: string; title: string } | null;
}

export interface ExpenseListResult extends PagedResult<Expense> {
  /** Sum over the whole filter, which is not the sum of the page on screen. */
  totalAmount: number;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  villaId?: string | null;
  maintenanceRecordId?: string | null;
  supplier?: string;
  notes?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  Utilities: 'Faturalar',
  Cleaning: 'Temizlik',
  Maintenance: 'Bakım',
  Staff: 'Personel',
  Supplies: 'Malzeme',
  Tax: 'Vergi',
  Other: 'Diğer',
};
