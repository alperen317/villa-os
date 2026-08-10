import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { PagedResult } from '../../core/models/paged-result.model';
import {
  CreateCustomerInput,
  Customer,
  UpdateCustomerInput,
} from '../../core/models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);

  async list(
    params: { page?: number; limit?: number; search?: string } = {},
  ): Promise<PagedResult<Customer>> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.search) query = query.set('search', params.search);

    const response = await firstValueFrom(
      this.http.get<Customer[]>(`${API_BASE_URL}/customers`, {
        params: query,
        observe: 'response',
      }),
    );

    return {
      data: response.body ?? [],
      total: Number(response.headers.get('X-Total-Count') ?? 0),
    };
  }

  async search(term: string, limit = 10): Promise<Customer[]> {
    const params = new HttpParams().set('search', term).set('limit', limit);
    const response = await firstValueFrom(
      this.http.get<Customer[]>(`${API_BASE_URL}/customers`, { params }),
    );
    return response;
  }

  async count(): Promise<number> {
    const response = await firstValueFrom(
      this.http.get<Customer[]>(`${API_BASE_URL}/customers`, {
        params: new HttpParams().set('limit', 1),
        observe: 'response',
      }),
    );
    return Number(response.headers.get('X-Total-Count') ?? 0);
  }

  create(input: CreateCustomerInput): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(`${API_BASE_URL}/customers`, input));
  }

  get(id: string): Promise<Customer> {
    return firstValueFrom(this.http.get<Customer>(`${API_BASE_URL}/customers/${id}`));
  }

  update(id: string, input: UpdateCustomerInput): Promise<Customer> {
    return firstValueFrom(this.http.patch<Customer>(`${API_BASE_URL}/customers/${id}`, input));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/customers/${id}`));
  }
}
