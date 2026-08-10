import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import {
  EXPENSE_CATEGORY_LABELS,
  Expense,
  ExpenseCategory,
} from '../../../core/models/expense.model';
import { VillasStore } from '../../villas/villas.store';
import { ExpensesService } from '../expenses.service';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Utilities: 'blue',
  Cleaning: 'cyan',
  Maintenance: 'orange',
  Staff: 'purple',
  Supplies: 'geekblue',
  Tax: 'red',
  Other: 'default',
};

/** Mirrors the `expenses.write` defaults in the API's permission catalog. */
const MUTATE_ROLES = new Set(['Administrator', 'Accounting']);

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * `expenseDate` is a date column that travels as midnight UTC. Reading it with local
 * getters lands on the previous day anywhere west of UTC, so the date part is taken as
 * written and rebuilt locally — the same construction the reservation calendar uses.
 */
function toLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzDatePickerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './expense-list.html',
  styleUrl: './expense-list.scss',
})
export class ExpenseList implements OnInit {
  private readonly expensesService = inject(ExpensesService);
  private readonly villasStore = inject(VillasStore);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly categoryLabels = EXPENSE_CATEGORY_LABELS;
  protected readonly categoryColors = CATEGORY_COLORS;
  protected readonly categoryKeys = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

  protected readonly villas = this.villasStore.villas;
  protected readonly filterVillaId = signal<string | null>(null);
  protected readonly filterCategory = signal<ExpenseCategory | null>(null);
  protected readonly filterRange = signal<[Date, Date] | null>(null);
  protected readonly searchTerm = signal('');

  protected readonly expenses = signal<Expense[]>([]);
  protected readonly total = signal(0);
  protected readonly totalAmount = signal(0);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected editingExpense: Expense | null = null;

  protected readonly canManage = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? MUTATE_ROLES.has(role) : false;
  });

  /** `expenses.delete` ships granted to no configurable role, so only the Administrator
   *  bypass reaches it — offering it to anyone else would only produce a 403. */
  protected readonly canDelete = computed(
    () => this.authService.currentUser()?.role === 'Administrator',
  );

  protected readonly form = this.formBuilder.nonNullable.group({
    category: ['Utilities' as ExpenseCategory, Validators.required],
    description: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    expenseDate: [new Date(), Validators.required],
    villaId: [null as string | null],
    supplier: [''],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.villasStore.ensureLoaded();
    await this.loadPage();
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    const range = this.filterRange();

    try {
      const result = await this.expensesService.list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        villaId: this.filterVillaId() ?? undefined,
        category: this.filterCategory() ?? undefined,
        dateFrom: range ? toIsoDate(range[0]) : undefined,
        dateTo: range ? toIsoDate(range[1]) : undefined,
        search: this.searchTerm() || undefined,
      });

      this.expenses.set(result.data);
      this.total.set(result.total);
      this.totalAmount.set(result.totalAmount);
    } catch {
      this.message.error('Giderler alınamadı');
    } finally {
      this.loading.set(false);
    }
  }

  onFilterChange(): void {
    // A narrowed filter usually has fewer pages than the one on screen, and asking for
    // page 4 of it would show an empty table that reads as "no expenses".
    this.pageIndex.set(1);
    this.loadPage();
  }

  onPageIndexChange(index: number): void {
    this.pageIndex.set(index);
    this.loadPage();
  }

  openCreateModal(): void {
    this.editingExpense = null;
    this.form.reset({
      category: 'Utilities',
      description: '',
      amount: 0,
      expenseDate: new Date(),
      villaId: null,
      supplier: '',
      notes: '',
    });
    this.modalVisible.set(true);
  }

  openEditModal(expense: Expense): void {
    this.editingExpense = expense;
    this.form.reset({
      category: expense.category,
      description: expense.description,
      amount: Number(expense.amount),
      expenseDate: toLocalDate(expense.expenseDate),
      villaId: expense.villaId,
      supplier: expense.supplier ?? '',
      notes: expense.notes ?? '',
    });
    this.modalVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.modalSaving.set(true);
    const value = this.form.getRawValue();
    const input = {
      category: value.category,
      description: value.description,
      amount: value.amount,
      expenseDate: toIsoDate(value.expenseDate),
      // Null rather than undefined: on an edit this is what turns a cost wrongly tagged
      // to a property back into a general one.
      villaId: value.villaId ?? null,
      supplier: value.supplier || undefined,
      notes: value.notes || undefined,
    };

    try {
      if (this.editingExpense) {
        await this.expensesService.update(this.editingExpense.id, input);
        this.message.success('Gider güncellendi');
      } else {
        await this.expensesService.create(input);
        this.message.success('Gider kaydedildi');
      }

      this.modalVisible.set(false);
      await this.loadPage();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
  }

  async remove(expense: Expense): Promise<void> {
    try {
      await this.expensesService.remove(expense.id);
      this.message.success('Gider silindi');
      await this.loadPage();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    }
  }

  protected currency(value: number | string): string {
    return `${Number(value).toLocaleString('tr-TR')} ₺`;
  }

  protected displayDate(isoDate: string): Date {
    return toLocalDate(isoDate);
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
