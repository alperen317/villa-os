import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { PermissionRow, PermissionUpdate } from '../../core/models/permission.model';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);

  get(): Promise<PermissionRow[]> {
    return firstValueFrom(this.http.get<PermissionRow[]>(`${API_BASE_URL}/permissions`));
  }

  update(updates: PermissionUpdate[]): Promise<PermissionRow[]> {
    return firstValueFrom(
      this.http.patch<PermissionRow[]>(`${API_BASE_URL}/permissions`, { updates }),
    );
  }
}
