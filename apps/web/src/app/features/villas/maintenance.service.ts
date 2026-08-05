import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import {
  CreateMaintenanceRecordInput,
  MaintenancePriority,
  MaintenanceRecord,
  MaintenanceRecordWithVilla,
  MaintenanceStatus,
} from '../../core/models/maintenance.model';

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly http = inject(HttpClient);

  list(
    villaId: string,
    params: { status?: MaintenanceStatus; priority?: MaintenancePriority } = {},
  ): Promise<MaintenanceRecord[]> {
    let query = new HttpParams();
    if (params.status) query = query.set('status', params.status);
    if (params.priority) query = query.set('priority', params.priority);

    return firstValueFrom(
      this.http.get<MaintenanceRecord[]>(`${API_BASE_URL}/villas/${villaId}/maintenance-records`, {
        params: query,
      }),
    );
  }

  listAll(
    params: { villaId?: string; status?: MaintenanceStatus; priority?: MaintenancePriority } = {},
  ): Promise<MaintenanceRecordWithVilla[]> {
    let query = new HttpParams();
    if (params.villaId) query = query.set('villaId', params.villaId);
    if (params.status) query = query.set('status', params.status);
    if (params.priority) query = query.set('priority', params.priority);

    return firstValueFrom(
      this.http.get<MaintenanceRecordWithVilla[]>(`${API_BASE_URL}/maintenance-records`, {
        params: query,
      }),
    );
  }

  create(villaId: string, input: CreateMaintenanceRecordInput): Promise<MaintenanceRecord> {
    return firstValueFrom(
      this.http.post<MaintenanceRecord>(`${API_BASE_URL}/villas/${villaId}/maintenance-records`, input),
    );
  }

  start(villaId: string, id: string): Promise<MaintenanceRecord> {
    return firstValueFrom(
      this.http.post<MaintenanceRecord>(
        `${API_BASE_URL}/villas/${villaId}/maintenance-records/${id}/start`,
        {},
      ),
    );
  }

  complete(villaId: string, id: string): Promise<MaintenanceRecord> {
    return firstValueFrom(
      this.http.post<MaintenanceRecord>(
        `${API_BASE_URL}/villas/${villaId}/maintenance-records/${id}/complete`,
        {},
      ),
    );
  }
}
