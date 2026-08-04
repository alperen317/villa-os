import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { PagedResult } from '../../core/models/paged-result.model';
import {
  CreateReservationInput,
  Reservation,
  ReservationStatus,
} from '../../core/models/reservation.model';

export type ReservationAction = 'confirm' | 'check-in' | 'check-out' | 'complete' | 'cancel';

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly http = inject(HttpClient);

  async list(
    params: {
      page?: number;
      limit?: number;
      villaId?: string;
      customerId?: string;
      status?: ReservationStatus;
    } = {},
  ): Promise<PagedResult<Reservation>> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.villaId) query = query.set('villaId', params.villaId);
    if (params.customerId) query = query.set('customerId', params.customerId);
    if (params.status) query = query.set('status', params.status);

    const response = await firstValueFrom(
      this.http.get<Reservation[]>(`${API_BASE_URL}/reservations`, {
        params: query,
        observe: 'response',
      }),
    );

    return {
      data: response.body ?? [],
      total: Number(response.headers.get('X-Total-Count') ?? 0),
    };
  }

  create(input: CreateReservationInput): Promise<Reservation> {
    return firstValueFrom(this.http.post<Reservation>(`${API_BASE_URL}/reservations`, input));
  }

  transition(id: string, action: ReservationAction): Promise<Reservation> {
    return firstValueFrom(
      this.http.post<Reservation>(`${API_BASE_URL}/reservations/${id}/${action}`, {}),
    );
  }
}
