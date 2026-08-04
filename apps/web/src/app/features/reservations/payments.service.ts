import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { CreatePaymentInput, Payment, PaymentsSummary } from '../../core/models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);

  getSummary(reservationId: string): Promise<PaymentsSummary> {
    return firstValueFrom(
      this.http.get<PaymentsSummary>(`${API_BASE_URL}/reservations/${reservationId}/payments`),
    );
  }

  create(reservationId: string, input: CreatePaymentInput): Promise<Payment> {
    return firstValueFrom(
      this.http.post<Payment>(`${API_BASE_URL}/reservations/${reservationId}/payments`, input),
    );
  }
}
