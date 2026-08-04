import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { CreateCustomerInput, Customer } from '../../core/models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);

  async search(term: string, limit = 10): Promise<Customer[]> {
    const params = new HttpParams().set('search', term).set('limit', limit);
    const response = await firstValueFrom(
      this.http.get<Customer[]>(`${API_BASE_URL}/customers`, { params }),
    );
    return response;
  }

  create(input: CreateCustomerInput): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(`${API_BASE_URL}/customers`, input));
  }

  get(id: string): Promise<Customer> {
    return firstValueFrom(this.http.get<Customer>(`${API_BASE_URL}/customers/${id}`));
  }
}
