import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import {
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
  ExpenseListResult,
  UpdateExpenseInput,
} from '../../core/models/expense.model';

export interface ListExpensesParams {
  page?: number;
  limit?: number;
  villaId?: string;
  category?: ExpenseCategory;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);

  async list(params: ListExpensesParams = {}): Promise<ExpenseListResult> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.villaId) query = query.set('villaId', params.villaId);
    if (params.category) query = query.set('category', params.category);
    if (params.dateFrom) query = query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query = query.set('dateTo', params.dateTo);
    if (params.search) query = query.set('search', params.search);

    const response = await firstValueFrom(
      this.http.get<Expense[]>(`${API_BASE_URL}/expenses`, {
        params: query,
        observe: 'response',
      }),
    );

    return {
      data: response.body ?? [],
      total: Number(response.headers.get('X-Total-Count') ?? 0),
      totalAmount: Number(response.headers.get('X-Total-Amount') ?? 0),
    };
  }

  get(id: string): Promise<Expense> {
    return firstValueFrom(this.http.get<Expense>(`${API_BASE_URL}/expenses/${id}`));
  }

  create(input: CreateExpenseInput): Promise<Expense> {
    return firstValueFrom(this.http.post<Expense>(`${API_BASE_URL}/expenses`, input));
  }

  update(id: string, input: UpdateExpenseInput): Promise<Expense> {
    return firstValueFrom(this.http.patch<Expense>(`${API_BASE_URL}/expenses/${id}`, input));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/expenses/${id}`));
  }
}
