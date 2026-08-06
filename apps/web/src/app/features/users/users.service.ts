import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { PagedResult } from '../../core/models/paged-result.model';
import { AppUser, CreateUserInput, UpdateUserInput } from '../../core/models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  async list(params: { page?: number; limit?: number } = {}): Promise<PagedResult<AppUser>> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);

    const response = await firstValueFrom(
      this.http.get<AppUser[]>(`${API_BASE_URL}/users`, { params: query, observe: 'response' }),
    );

    return {
      data: response.body ?? [],
      total: Number(response.headers.get('X-Total-Count') ?? 0),
    };
  }

  create(input: CreateUserInput): Promise<AppUser> {
    return firstValueFrom(this.http.post<AppUser>(`${API_BASE_URL}/users`, input));
  }

  update(id: string, input: UpdateUserInput): Promise<AppUser> {
    return firstValueFrom(this.http.patch<AppUser>(`${API_BASE_URL}/users/${id}`, input));
  }

  activate(id: string): Promise<AppUser> {
    return firstValueFrom(this.http.post<AppUser>(`${API_BASE_URL}/users/${id}/activate`, {}));
  }

  deactivate(id: string): Promise<AppUser> {
    return firstValueFrom(this.http.post<AppUser>(`${API_BASE_URL}/users/${id}/deactivate`, {}));
  }

  resetPassword(id: string, password: string): Promise<AppUser> {
    return firstValueFrom(
      this.http.post<AppUser>(`${API_BASE_URL}/users/${id}/reset-password`, { password }),
    );
  }
}
