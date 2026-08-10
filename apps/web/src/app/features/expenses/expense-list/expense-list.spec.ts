import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzNativeDateAdapter } from 'ng-zorro-antd/core/time';
import { provideNzI18n, tr_TR } from 'ng-zorro-antd/i18n';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../../core/auth/auth.service';
import { Expense } from '../../../core/models/expense.model';
import { VillasStore } from '../../villas/villas.store';
import { ExpensesService } from '../expenses.service';
import { ExpenseList } from './expense-list';

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    villaId: null,
    maintenanceRecordId: null,
    category: 'Utilities',
    description: 'Elektrik faturası',
    amount: '1250.50',
    expenseDate: '2026-03-10T00:00:00.000Z',
    supplier: null,
    notes: null,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-10T00:00:00.000Z',
    villa: null,
    maintenanceRecord: null,
    ...overrides,
  };
}

describe('ExpenseList', () => {
  let component: ExpenseList;
  let expensesService: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let currentUser: ReturnType<typeof signal<{ role: string } | null>>;
  let message: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    expensesService = {
      list: jest.fn().mockResolvedValue({ data: [], total: 0, totalAmount: 0 }),
      create: jest.fn().mockResolvedValue(expense()),
      update: jest.fn().mockResolvedValue(expense()),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    currentUser = signal<{ role: string } | null>({ role: 'Accounting' });
    message = { success: jest.fn(), error: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        // The template renders a date picker, which reaches for these the moment the
        // component is created rather than merely constructed.
        provideNzI18n(tr_TR),
        provideNzNativeDateAdapter(),
        { provide: ExpensesService, useValue: expensesService },
        { provide: VillasStore, useValue: { villas: signal([]), ensureLoaded: jest.fn() } },
        { provide: AuthService, useValue: { currentUser } },
        { provide: NzMessageService, useValue: message },
      ],
    });

    component = TestBed.runInInjectionContext(() => new ExpenseList());
  });

  describe('the rendered total', () => {
    it('prints the whole figure, millions and currency symbol included', async () => {
      // nz-statistic splits a *string* value on "." and keeps only the first two parts, so
      // handing it a pre-formatted "1.693.844,64 ₺" renders "1.693" — off by a thousand and
      // missing the symbol. Only a rendered assertion catches that; constructing the
      // component cannot see its template.
      expensesService.list.mockResolvedValue({ data: [], total: 328, totalAmount: 1693844.64 });

      const fixture = TestBed.createComponent(ExpenseList);
      await fixture.componentInstance.loadPage();
      fixture.detectChanges();

      const totals = fixture.nativeElement.querySelector('.totals').textContent;
      expect(totals).toContain('1.693.844,64 ₺');
    });
  });

  describe('permissions', () => {
    it.each([
      ['Administrator', true],
      ['Accounting', true],
      ['Operations', false],
      ['Housekeeping', false],
    ])('lets %s record an expense: %s', (role, allowed) => {
      currentUser.set({ role });

      expect(component['canManage']()).toBe(allowed);
    });

    it.each([
      ['Administrator', true],
      ['Accounting', false],
      ['Operations', false],
    ])('lets %s delete one: %s', (role, allowed) => {
      // `expenses.delete` is granted to no configurable role, so anyone but the admin
      // would only get a 403 out of the button.
      currentUser.set({ role });

      expect(component['canDelete']()).toBe(allowed);
    });

    it('offers nothing to a signed-out session', () => {
      currentUser.set(null);

      expect(component['canManage']()).toBe(false);
      expect(component['canDelete']()).toBe(false);
    });
  });

  describe('filtering', () => {
    it('sends the chosen range as the days the user picked, not their UTC shift', async () => {
      // Serialising the picker's local Date through toISOString would move the bound a day
      // back anywhere west of UTC, quietly dropping a day's expenses off the edge.
      component['filterRange'].set([new Date(2026, 2, 1), new Date(2026, 2, 31)]);

      await component.loadPage();

      expect(expensesService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }),
      );
    });

    it('omits the bounds entirely when no range is set', async () => {
      await component.loadPage();

      expect(expensesService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateFrom: undefined, dateTo: undefined }),
      );
    });

    it('returns to the first page when a filter narrows the results', async () => {
      component.onPageIndexChange(4);
      expect(component['pageIndex']()).toBe(4);

      component['filterCategory'].set('Staff');
      component.onFilterChange();

      expect(component['pageIndex']()).toBe(1);
      expect(expensesService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, category: 'Staff' }),
      );
    });

    it('carries the search term through, and omits an empty one', async () => {
      component['searchTerm'].set('elektrik');
      await component.loadPage();
      expect(expensesService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'elektrik' }),
      );

      component['searchTerm'].set('');
      await component.loadPage();
      expect(expensesService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined }),
      );
    });

    it('shows the total for the whole filter, not for the page', async () => {
      expensesService.list.mockResolvedValue({
        data: [expense()],
        total: 87,
        totalAmount: 43210.75,
      });

      await component.loadPage();

      expect(component['total']()).toBe(87);
      expect(component['totalAmount']()).toBe(43210.75);
    });

    it('stops the spinner when the list cannot be read', async () => {
      expensesService.list.mockRejectedValue(new Error('offline'));

      await component.loadPage();

      expect(component['loading']()).toBe(false);
      expect(message.error).toHaveBeenCalled();
    });
  });

  describe('the edit modal', () => {
    it('reads the stored date back as the day it names', () => {
      component.openEditModal(expense({ expenseDate: '2026-03-10T00:00:00.000Z' }));

      const picked = component['form'].getRawValue().expenseDate;
      expect(picked.getFullYear()).toBe(2026);
      expect(picked.getMonth()).toBe(2);
      expect(picked.getDate()).toBe(10);
    });

    it('turns the string amount back into a number the input can edit', () => {
      component.openEditModal(expense({ amount: '1250.50' }));

      expect(component['form'].getRawValue().amount).toBe(1250.5);
    });

    it('starts a new expense on today with no villa attached', () => {
      component.openEditModal(expense({ villaId: 'villa-1' }));
      component.openCreateModal();

      expect(component['editingExpense']).toBeNull();
      expect(component['form'].getRawValue().villaId).toBeNull();
    });
  });

  describe('save', () => {
    it('posts the date as the day picked rather than an instant', async () => {
      component.openCreateModal();
      component['form'].patchValue({
        description: 'Su faturası',
        amount: 500,
        expenseDate: new Date(2026, 2, 10),
      });

      await component.save();

      expect(expensesService.create).toHaveBeenCalledWith(
        expect.objectContaining({ expenseDate: '2026-03-10' }),
      );
    });

    it('sends null for the villa so an edit can clear it', async () => {
      // undefined would be dropped as "unchanged" and leave the cost tagged to a property
      // it does not belong to.
      component.openEditModal(expense({ id: 'expense-9', villaId: 'villa-1' }));
      component['form'].patchValue({ villaId: null });

      await component.save();

      expect(expensesService.update).toHaveBeenCalledWith(
        'expense-9',
        expect.objectContaining({ villaId: null }),
      );
    });

    it('refuses to post an amount of zero', async () => {
      component.openCreateModal();
      component['form'].patchValue({ description: 'Bir şey', amount: 0 });

      await component.save();

      expect(expensesService.create).not.toHaveBeenCalled();
    });

    it('keeps the modal open and reports the reason when saving fails', async () => {
      expensesService.create.mockRejectedValue({
        error: { message: 'Seçilen bakım kaydı başka bir villaya ait' },
      });
      component.openCreateModal();
      component['form'].patchValue({ description: 'Kombi tamiri', amount: 900 });

      await component.save();

      expect(component['modalVisible']()).toBe(true);
      expect(component['modalSaving']()).toBe(false);
      expect(message.error).toHaveBeenCalledWith('Seçilen bakım kaydı başka bir villaya ait');
    });
  });

  describe('remove', () => {
    it('re-reads the page after deleting, so the row disappears', async () => {
      await component.remove(expense({ id: 'expense-9' }));

      expect(expensesService.remove).toHaveBeenCalledWith('expense-9');
      expect(expensesService.list).toHaveBeenCalled();
      expect(message.success).toHaveBeenCalled();
    });

    it('reports a refusal rather than pretending the row is gone', async () => {
      expensesService.remove.mockRejectedValue(new Error('403'));

      await component.remove(expense());

      expect(message.error).toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
    });
  });
});
