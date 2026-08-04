import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { PagedResult } from '../../core/models/paged-result.model';
import {
  CreateFloorInput,
  CreateVillaInput,
  Floor,
  UpdateFloorInput,
  UpdateVillaInput,
  Villa,
  VillaStatus,
} from '../../core/models/villa.model';

@Injectable({ providedIn: 'root' })
export class VillasService {
  private readonly http = inject(HttpClient);

  async list(params: { page?: number; limit?: number; status?: VillaStatus } = {}): Promise<
    PagedResult<Villa>
  > {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.status) query = query.set('status', params.status);

    const response = await firstValueFrom(
      this.http.get<Villa[]>(`${API_BASE_URL}/villas`, { params: query, observe: 'response' }),
    );

    return {
      data: response.body ?? [],
      total: Number(response.headers.get('X-Total-Count') ?? 0),
    };
  }

  get(id: string): Promise<Villa> {
    return firstValueFrom(this.http.get<Villa>(`${API_BASE_URL}/villas/${id}`));
  }

  create(input: CreateVillaInput): Promise<Villa> {
    return firstValueFrom(this.http.post<Villa>(`${API_BASE_URL}/villas`, input));
  }

  update(id: string, input: UpdateVillaInput): Promise<Villa> {
    return firstValueFrom(this.http.patch<Villa>(`${API_BASE_URL}/villas/${id}`, input));
  }

  activate(id: string): Promise<Villa> {
    return firstValueFrom(this.http.post<Villa>(`${API_BASE_URL}/villas/${id}/activate`, {}));
  }

  deactivate(id: string): Promise<Villa> {
    return firstValueFrom(this.http.post<Villa>(`${API_BASE_URL}/villas/${id}/deactivate`, {}));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/villas/${id}`));
  }

  listFloors(villaId: string): Promise<Floor[]> {
    return firstValueFrom(this.http.get<Floor[]>(`${API_BASE_URL}/villas/${villaId}/floors`));
  }

  createFloor(villaId: string, input: CreateFloorInput): Promise<Floor> {
    return firstValueFrom(
      this.http.post<Floor>(`${API_BASE_URL}/villas/${villaId}/floors`, input),
    );
  }

  updateFloor(villaId: string, id: string, input: UpdateFloorInput): Promise<Floor> {
    return firstValueFrom(
      this.http.patch<Floor>(`${API_BASE_URL}/villas/${villaId}/floors/${id}`, input),
    );
  }

  removeFloor(villaId: string, id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API_BASE_URL}/villas/${villaId}/floors/${id}`),
    );
  }
}
