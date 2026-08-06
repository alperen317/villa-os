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
import { FloorWithVilla } from '../../core/models/villa.model';
import { SyncOutboxItem, UpdateReservationPayload } from '../../core/sync/sync-queue.model';
import { SyncQueueStore } from '../../core/sync/sync-queue.store';

export type ReservationAction = 'confirm' | 'check-in' | 'check-out' | 'complete' | 'cancel';

/** A write either went straight to the API (queued: false) or was appended to the offline sync outbox (queued: true). */
export type ReservationWriteResult =
  | { queued: false; reservation: Reservation }
  | { queued: true; item: SyncOutboxItem };

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly http = inject(HttpClient);
  private readonly syncQueueStore = inject(SyncQueueStore);

  async list(
    params: {
      page?: number;
      limit?: number;
      villaId?: string;
      customerId?: string;
      status?: ReservationStatus;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    } = {},
  ): Promise<PagedResult<Reservation>> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.villaId) query = query.set('villaId', params.villaId);
    if (params.customerId) query = query.set('customerId', params.customerId);
    if (params.status) query = query.set('status', params.status);
    if (params.dateFrom) query = query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query = query.set('dateTo', params.dateTo);
    if (params.search) query = query.set('search', params.search);

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

  get(id: string): Promise<Reservation> {
    return firstValueFrom(this.http.get<Reservation>(`${API_BASE_URL}/reservations/${id}`));
  }

  async create(input: CreateReservationInput, summary: string): Promise<ReservationWriteResult> {
    if (this.shouldQueue()) {
      const item = await this.syncQueueStore.enqueueCreate(input, summary);
      this.triggerReplay();
      return { queued: true, item };
    }

    const reservation = await firstValueFrom(
      this.http.post<Reservation>(`${API_BASE_URL}/reservations`, input),
    );
    return { queued: false, reservation };
  }

  /** Guest count / notes only — dates and unit are immutable (cancel and rebook instead). */
  async update(
    reservation: Reservation,
    payload: UpdateReservationPayload,
  ): Promise<ReservationWriteResult> {
    if (this.shouldQueue()) {
      const item = await this.syncQueueStore.enqueueUpdate(
        reservation.id,
        payload,
        reservation.updatedAt,
        this.summarize(reservation),
      );
      this.triggerReplay();
      return { queued: true, item };
    }

    const updated = await firstValueFrom(
      this.http.patch<Reservation>(`${API_BASE_URL}/reservations/${reservation.id}`, {
        ...payload,
        expectedUpdatedAt: reservation.updatedAt,
      }),
    );
    return { queued: false, reservation: updated };
  }

  async transition(reservation: Reservation, action: ReservationAction): Promise<ReservationWriteResult> {
    if (action === 'cancel' && this.shouldQueue()) {
      const item = await this.syncQueueStore.enqueueCancel(reservation.id, this.summarize(reservation));
      this.triggerReplay();
      return { queued: true, item };
    }

    const updated = await firstValueFrom(
      this.http.post<Reservation>(`${API_BASE_URL}/reservations/${reservation.id}/${action}`, {}),
    );
    return { queued: false, reservation: updated };
  }

  private summarize(reservation: Reservation): string {
    return `${reservation.villa.name} / ${reservation.floor.name} · ${reservation.customer.firstName} ${reservation.customer.lastName}`;
  }

  /** Route through the outbox when offline, or when it already holds items — keeps writes in FIFO order. */
  private shouldQueue(): boolean {
    return !navigator.onLine || this.syncQueueStore.totalCount() > 0;
  }

  private triggerReplay(): void {
    void this.syncQueueStore.replay();
  }

  checkAvailability(params: {
    checkIn: string;
    checkOut: string;
    villaId?: string;
  }): Promise<FloorWithVilla[]> {
    let query = new HttpParams().set('checkIn', params.checkIn).set('checkOut', params.checkOut);
    if (params.villaId) query = query.set('villaId', params.villaId);

    return firstValueFrom(
      this.http.get<FloorWithVilla[]>(`${API_BASE_URL}/reservations/availability`, {
        params: query,
      }),
    );
  }
}
