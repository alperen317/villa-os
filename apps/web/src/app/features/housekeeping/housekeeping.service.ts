import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { HousekeepingStatus, HousekeepingTask } from '../../core/models/housekeeping.model';

@Injectable({ providedIn: 'root' })
export class HousekeepingService {
  private readonly http = inject(HttpClient);

  list(params: { villaId?: string; status?: HousekeepingStatus } = {}): Promise<HousekeepingTask[]> {
    let query = new HttpParams();
    if (params.villaId) query = query.set('villaId', params.villaId);
    if (params.status) query = query.set('status', params.status);

    return firstValueFrom(
      this.http.get<HousekeepingTask[]>(`${API_BASE_URL}/housekeeping-tasks`, { params: query }),
    );
  }

  start(id: string): Promise<HousekeepingTask> {
    return firstValueFrom(
      this.http.post<HousekeepingTask>(`${API_BASE_URL}/housekeeping-tasks/${id}/start`, {}),
    );
  }

  complete(id: string): Promise<HousekeepingTask> {
    return firstValueFrom(
      this.http.post<HousekeepingTask>(`${API_BASE_URL}/housekeeping-tasks/${id}/complete`, {}),
    );
  }
}
