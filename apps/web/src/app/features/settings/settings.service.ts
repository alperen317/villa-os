import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { Settings, UpdateSettingsInput } from '../../core/models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);

  get(): Promise<Settings> {
    return firstValueFrom(this.http.get<Settings>(`${API_BASE_URL}/settings`));
  }

  update(input: UpdateSettingsInput): Promise<Settings> {
    return firstValueFrom(this.http.patch<Settings>(`${API_BASE_URL}/settings`, input));
  }

  uploadLogo(file: File): Promise<Settings> {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(this.http.post<Settings>(`${API_BASE_URL}/settings/logo`, formData));
  }

  removeLogo(): Promise<Settings> {
    return firstValueFrom(this.http.delete<Settings>(`${API_BASE_URL}/settings/logo`));
  }
}
