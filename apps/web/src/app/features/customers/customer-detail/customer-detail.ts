import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Customer } from '../../../core/models/customer.model';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  Reservation,
} from '../../../core/models/reservation.model';
import { ReservationsService } from '../../reservations/reservations.service';
import { CustomersService } from '../customers.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSkeletonModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.scss',
})
export class CustomerDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly customersService = inject(CustomersService);
  private readonly reservationsService = inject(ReservationsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);

  protected readonly customer = signal<Customer | null>(null);
  protected readonly loading = signal(false);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);

  protected readonly reservationStatusLabels = RESERVATION_STATUS_LABELS;
  protected readonly reservationStatusColors = RESERVATION_STATUS_COLORS;
  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly reservationsLoading = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: [''],
    email: ['', Validators.email],
    identityNumber: [''],
    passportNumber: [''],
    notes: [''],
  });

  private get customerId(): string {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      // Only reachable if the route loses its :id segment — worth failing loudly rather
      // than letting `undefined` travel into a request URL and come back a confusing 404.
      throw new Error('CustomerDetail was routed to without an :id parameter');
    }
    return id;
  }

  ngOnInit(): void {
    this.load();
    this.loadReservations();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.customer.set(await this.customersService.get(this.customerId));
    } finally {
      this.loading.set(false);
    }
  }

  async loadReservations(): Promise<void> {
    this.reservationsLoading.set(true);
    try {
      const result = await this.reservationsService.list({
        customerId: this.customerId,
        limit: 20,
      });
      this.reservations.set(result.data);
    } catch {
      this.message.error('Rezervasyonlar alınamadı');
    } finally {
      this.reservationsLoading.set(false);
    }
  }

  openEditModal(): void {
    const customer = this.customer();
    if (!customer) return;

    this.form.reset({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      identityNumber: customer.identityNumber ?? '',
      passportNumber: customer.passportNumber ?? '',
      notes: customer.notes ?? '',
    });
    this.modalVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.modalSaving.set(true);
    const value = this.form.getRawValue();

    try {
      const updated = await this.customersService.update(this.customerId, {
        firstName: value.firstName,
        lastName: value.lastName,
        phone: value.phone || undefined,
        email: value.email || undefined,
        identityNumber: value.identityNumber || undefined,
        passportNumber: value.passportNumber || undefined,
        notes: value.notes || undefined,
      });

      this.customer.set(updated);
      this.message.success('Müşteri güncellendi');
      this.modalVisible.set(false);
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
