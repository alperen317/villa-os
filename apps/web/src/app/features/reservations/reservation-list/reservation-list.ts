import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '../../../core/auth/auth.service';
import { Customer } from '../../../core/models/customer.model';
import {
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  PaymentsSummary,
} from '../../../core/models/payment.model';
import {
  RESERVATION_NEXT_ACTIONS,
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  Reservation,
  ReservationStatus,
} from '../../../core/models/reservation.model';
import { Floor, FloorWithVilla } from '../../../core/models/villa.model';
import { CustomersService } from '../../customers/customers.service';
import { VillasService } from '../../villas/villas.service';
import { VillasStore } from '../../villas/villas.store';
import { PaymentsService } from '../payments.service';
import { ReservationAction, ReservationsService } from '../reservations.service';

const PAYMENT_MANAGER_ROLES = new Set(['Administrator', 'Accounting']);

@Component({
  selector: 'app-reservation-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzCalendarModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzDropdownModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSegmentedModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTooltipModule,
  ],
  templateUrl: './reservation-list.html',
  styleUrl: './reservation-list.scss',
})
export class ReservationList implements OnInit {
  private readonly reservationsService = inject(ReservationsService);
  private readonly villasService = inject(VillasService);
  private readonly villasStore = inject(VillasStore);
  private readonly customersService = inject(CustomersService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);

  protected readonly statusLabels = RESERVATION_STATUS_LABELS;
  protected readonly nextActions = RESERVATION_NEXT_ACTIONS;
  protected readonly statusColors = RESERVATION_STATUS_COLORS;
  protected readonly statusKeys = Object.keys(RESERVATION_STATUS_LABELS) as ReservationStatus[];

  protected readonly viewMode = signal<'list' | 'calendar' | 'availability'>('list');

  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly calendarReservations = signal<Reservation[]>([]);
  protected readonly calendarLoading = signal(false);

  protected readonly villas = this.villasStore.villas;
  protected readonly filterVillaId = signal<string | null>(null);
  protected readonly filterStatus = signal<ReservationStatus | null>(null);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected readonly formFloors = signal<Floor[]>([]);
  protected readonly customerOptions = signal<Customer[]>([]);
  protected readonly showNewCustomerForm = signal(false);
  protected readonly creatingCustomer = signal(false);

  protected readonly detailVisible = signal(false);
  protected readonly detailReservation = signal<Reservation | null>(null);

  protected readonly paymentsSummary = signal<PaymentsSummary | null>(null);
  protected readonly paymentsLoading = signal(false);
  protected readonly paymentModalVisible = signal(false);
  protected readonly paymentSaving = signal(false);

  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly paymentMethodKeys = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

  protected readonly canManagePayments = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? PAYMENT_MANAGER_ROLES.has(role) : false;
  });

  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethod: ['Cash' as PaymentMethod, Validators.required],
    paymentDate: [null as Date | null],
    referenceNumber: [''],
    notes: [''],
  });

  protected readonly availabilityResults = signal<FloorWithVilla[] | null>(null);
  protected readonly availabilitySearching = signal(false);

  protected readonly availabilityForm = this.formBuilder.nonNullable.group({
    dateRange: [null as [Date, Date] | null, Validators.required],
    villaId: [''],
  });

  protected readonly form = this.formBuilder.nonNullable.group({
    villaId: ['', Validators.required],
    floorId: ['', Validators.required],
    dateRange: [null as [Date, Date] | null, Validators.required],
    guestCount: [1, [Validators.required, Validators.min(1)]],
    customerId: ['', Validators.required],
    notes: [''],
  });

  protected readonly newCustomerForm = this.formBuilder.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.villasStore.ensureLoaded();
    await this.loadPage();

    this.form.controls.villaId.valueChanges.subscribe((villaId) => {
      this.onVillaChange(villaId);
    });
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.reservationsService.list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        villaId: this.filterVillaId() ?? undefined,
        status: this.filterStatus() ?? undefined,
      });
      this.reservations.set(result.data);
      this.total.set(result.total);
    } finally {
      this.loading.set(false);
    }
  }

  async loadCalendarData(): Promise<void> {
    this.calendarLoading.set(true);
    try {
      const result = await this.reservationsService.list({
        page: 1,
        limit: 100,
        villaId: this.filterVillaId() ?? undefined,
        status: this.filterStatus() ?? undefined,
      });
      this.calendarReservations.set(result.data);
    } finally {
      this.calendarLoading.set(false);
    }
  }

  setViewMode(mode: string | number): void {
    const nextMode = mode === 'calendar' || mode === 'availability' ? mode : 'list';
    this.viewMode.set(nextMode);
    if (nextMode === 'calendar') {
      this.loadCalendarData();
    }
  }

  async searchAvailability(): Promise<void> {
    if (this.availabilityForm.invalid) {
      return;
    }

    const value = this.availabilityForm.getRawValue();
    const [checkIn, checkOut] = value.dateRange!;

    this.availabilitySearching.set(true);
    try {
      this.availabilityResults.set(
        await this.reservationsService.checkAvailability({
          checkIn: this.toIsoDate(checkIn),
          checkOut: this.toIsoDate(checkOut),
          villaId: value.villaId || undefined,
        }),
      );
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.availabilitySearching.set(false);
    }
  }

  async bookFromAvailability(floor: FloorWithVilla): Promise<void> {
    const dateRange = this.availabilityForm.getRawValue().dateRange;
    await this.openCreateModal();
    this.form.patchValue({ villaId: floor.villaId, dateRange });
    this.formFloors.set([floor]);
    this.form.patchValue({ floorId: floor.id });
  }

  onPageIndexChange(index: number): void {
    this.pageIndex.set(index);
    this.loadPage();
  }

  onFilterChange(): void {
    this.pageIndex.set(1);
    this.loadPage();
    if (this.viewMode() === 'calendar') {
      this.loadCalendarData();
    }
  }

  checkInsForDate(date: Date): Reservation[] {
    const day = this.stripTime(date);
    return this.calendarReservations().filter(
      (reservation) => this.stripTime(new Date(reservation.checkIn)) === day,
    );
  }

  checkOutsForDate(date: Date): Reservation[] {
    const day = this.stripTime(date);
    return this.calendarReservations().filter(
      (reservation) => this.stripTime(new Date(reservation.checkOut)) === day,
    );
  }

  openDetail(reservation: Reservation): void {
    this.detailReservation.set(reservation);
    this.detailVisible.set(true);
    this.paymentsSummary.set(null);
    this.loadPaymentsSummary(reservation.id);
  }

  async loadPaymentsSummary(reservationId: string): Promise<void> {
    this.paymentsLoading.set(true);
    try {
      this.paymentsSummary.set(await this.paymentsService.getSummary(reservationId));
    } catch {
      this.message.error('Ödeme bilgisi alınamadı');
    } finally {
      this.paymentsLoading.set(false);
    }
  }

  openAddPaymentModal(): void {
    this.paymentForm.reset({
      amount: 0,
      paymentMethod: 'Cash',
      paymentDate: null,
      referenceNumber: '',
      notes: '',
    });
    this.paymentModalVisible.set(true);
  }

  async savePayment(): Promise<void> {
    const reservation = this.detailReservation();
    if (this.paymentForm.invalid || !reservation) {
      return;
    }

    const value = this.paymentForm.getRawValue();

    this.paymentSaving.set(true);
    try {
      await this.paymentsService.create(reservation.id, {
        amount: value.amount,
        paymentMethod: value.paymentMethod,
        paymentDate: value.paymentDate ? this.toIsoDate(value.paymentDate) : undefined,
        referenceNumber: value.referenceNumber || undefined,
        notes: value.notes || undefined,
      });

      this.message.success('Ödeme kaydedildi');
      this.paymentModalVisible.set(false);
      await this.loadPaymentsSummary(reservation.id);
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.paymentSaving.set(false);
    }
  }

  async openCreateModal(): Promise<void> {
    this.form.reset({
      villaId: '',
      floorId: '',
      dateRange: null,
      guestCount: 1,
      customerId: '',
      notes: '',
    });
    this.formFloors.set([]);
    this.customerOptions.set([]);
    this.showNewCustomerForm.set(false);
    this.modalVisible.set(true);
  }

  private async onVillaChange(villaId: string): Promise<void> {
    this.form.patchValue({ floorId: '' });
    if (!villaId) {
      this.formFloors.set([]);
      return;
    }

    const floors = await this.villasService.listFloors(villaId);
    this.formFloors.set(floors.filter((floor) => floor.rentable));
  }

  async onCustomerSearch(term: string): Promise<void> {
    if (!term || term.trim().length < 2) {
      this.customerOptions.set([]);
      return;
    }

    this.customerOptions.set(await this.customersService.search(term));
  }

  toggleNewCustomerForm(): void {
    this.showNewCustomerForm.set(!this.showNewCustomerForm());
  }

  async createCustomerInline(): Promise<void> {
    if (this.newCustomerForm.invalid) {
      return;
    }

    this.creatingCustomer.set(true);
    try {
      const customer = await this.customersService.create(this.newCustomerForm.getRawValue());
      this.customerOptions.set([customer, ...this.customerOptions()]);
      this.form.patchValue({ customerId: customer.id });
      this.showNewCustomerForm.set(false);
      this.newCustomerForm.reset({ firstName: '', lastName: '', phone: '' });
      this.message.success('Müşteri oluşturuldu');
    } catch {
      this.message.error('Müşteri oluşturulamadı');
    } finally {
      this.creatingCustomer.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const [checkIn, checkOut] = value.dateRange!;

    this.modalSaving.set(true);
    try {
      await this.reservationsService.create({
        customerId: value.customerId,
        villaId: value.villaId,
        floorId: value.floorId,
        checkIn: this.toIsoDate(checkIn),
        checkOut: this.toIsoDate(checkOut),
        guestCount: value.guestCount,
        notes: value.notes || undefined,
      });

      this.message.success('Rezervasyon oluşturuldu');
      this.modalVisible.set(false);
      await this.loadPage();
      if (this.viewMode() === 'calendar') {
        await this.loadCalendarData();
      }
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
  }

  async runAction(reservation: Reservation, action: string): Promise<void> {
    try {
      await this.reservationsService.transition(reservation.id, action as ReservationAction);
      this.message.success('Durum güncellendi');
      this.detailVisible.set(false);
      await this.loadPage();
      if (this.viewMode() === 'calendar') {
        await this.loadCalendarData();
      }
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    }
  }

  private stripTime(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
