import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import {
  CustomersReport,
  OccupancyReport,
  ReportQuery,
  ReservationsReport,
  RevenueReport,
} from '../../core/models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);

  getOccupancy(query: ReportQuery): Promise<OccupancyReport> {
    return firstValueFrom(
      this.http.get<OccupancyReport>(`${API_BASE_URL}/reports/occupancy`, { params: this.toParams(query) }),
    );
  }

  getRevenue(query: ReportQuery): Promise<RevenueReport> {
    return firstValueFrom(
      this.http.get<RevenueReport>(`${API_BASE_URL}/reports/revenue`, { params: this.toParams(query) }),
    );
  }

  getReservations(query: ReportQuery): Promise<ReservationsReport> {
    return firstValueFrom(
      this.http.get<ReservationsReport>(`${API_BASE_URL}/reports/reservations`, { params: this.toParams(query) }),
    );
  }

  getCustomers(query: ReportQuery): Promise<CustomersReport> {
    return firstValueFrom(
      this.http.get<CustomersReport>(`${API_BASE_URL}/reports/customers`, { params: this.toParams(query) }),
    );
  }

  private toParams(query: ReportQuery): HttpParams {
    let params = new HttpParams().set('from', query.from).set('to', query.to);
    if (query.villaId) params = params.set('villaId', query.villaId);
    return params;
  }
}
