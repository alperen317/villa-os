import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '../../../core/auth/auth.service';
import { ViewportService } from '../../../core/layout/viewport.service';
import { Customer } from '../../../core/models/customer.model';
import { SyncOutboxItem, UpdateReservationPayload } from '../../../core/sync/sync-queue.model';
import { SyncQueueStore } from '../../../core/sync/sync-queue.store';
import {
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  PaymentsSummary,
} from '../../../core/models/payment.model';
import {
  RESERVATION_NEXT_ACTIONS,
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  CreateReservationInput,
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

/** The API's hard ceiling on `limit` (see PaginationQueryDto) — the fewest round trips the
 *  calendar can drain a month in. */
const CALENDAR_PAGE_SIZE = 100;

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
    NzPopconfirmModule,
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
  protected readonly viewport = inject(ViewportService);
  private readonly syncQueueStore = inject(SyncQueueStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
  private calendarRequestId = 0;

  /** The month the grid is showing. Header navigation moves this; the day panel deliberately
   *  does not follow it (see onCalendarSelect), so the two are tracked separately. */
  protected readonly activeCalendarDate = signal(new Date());

  /** On mobile the calendar renders in card mode, where a day cell only fits a dot per event
   *  kind. The selected day's arrivals and departures are listed below the grid instead, so
   *  the detail the fullscreen cells carry on desktop stays reachable. */
  protected readonly selectedCalendarDate = signal(new Date());
  protected readonly selectedDayCheckIns = computed(() =>
    this.checkInsForDate(this.selectedCalendarDate()),
  );
  protected readonly selectedDayCheckOuts = computed(() =>
    this.checkOutsForDate(this.selectedCalendarDate()),
  );

  protected readonly villas = this.villasStore.villas;
  protected readonly filterVillaId = signal<string | null>(null);
  protected readonly filterStatus = signal<ReservationStatus | null>(null);
  protected readonly filterDateRange = signal<[Date, Date] | null>(null);
  protected readonly filterDatePreset = signal<string | null>(null);
  protected readonly filterSearch = signal('');
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected readonly formFloors = signal<Floor[]>([]);
  protected readonly customerOptions = signal<Customer[]>([]);
  /** ng-zorro's searchable select clears customerOptions right after a selection (its own
   *  search box reset fires nzOnSearch('')) — capture the name at selection time instead of
   *  re-deriving it from customerOptions later, e.g. when building the offline queue summary. */
  private readonly selectedCustomerName = signal<string | null>(null);
  protected readonly showNewCustomerForm = signal(false);
  protected readonly creatingCustomer = signal(false);

  protected readonly detailVisible = signal(false);
  protected readonly detailReservation = signal<Reservation | null>(null);

  protected readonly editModalVisible = signal(false);
  protected readonly editModalSaving = signal(false);
  protected readonly editingReservation = signal<Reservation | null>(null);

  protected readonly paymentsSummary = signal<PaymentsSummary | null>(null);
  protected readonly paymentsLoading = signal(false);
  protected readonly paymentModalVisible = signal(false);
  protected readonly paymentSaving = signal(false);

  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly paymentMethodKeys = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

  protected readonly pendingCreateItems = computed(() =>
    this.syncQueueStore.items().filter((item) => item.type === 'create-reservation'),
  );

  protected readonly canManagePayments = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? PAYMENT_MANAGER_ROLES.has(role) : false;
  });

  /** `reservations.delete` ships granted to no configurable role, so only the Administrator
   *  bypass reaches it — showing the button to anyone else would only produce a 403. */
  protected readonly canDelete = computed(
    () => this.authService.currentUser()?.role === 'Administrator',
  );

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

  protected readonly editForm = this.formBuilder.nonNullable.group({
    guestCount: [1, [Validators.required, Validators.min(1)]],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const item = this.syncQueueStore.resolveTarget();
      if (item) {
        void this.handleResolveTarget(item);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.villasStore.ensureLoaded();
    await this.loadPage();

    this.form.controls.villaId.valueChanges.subscribe((villaId) => {
      this.onVillaChange(villaId);
    });

    this.form.controls.customerId.valueChanges.subscribe((customerId) => {
      const customer = this.customerOptions().find((c) => c.id === customerId);
      this.selectedCustomerName.set(customer ? `${customer.firstName} ${customer.lastName}` : null);
    });

    await this.openDetailFromQueryParam();
  }

  /** Lets other screens (e.g. Housekeeping) deep-link to a reservation via ?res=<id>. */
  private async openDetailFromQueryParam(): Promise<void> {
    const reservationId = this.route.snapshot.queryParamMap.get('res');
    if (!reservationId) {
      return;
    }

    this.router.navigate([], { queryParams: {} });

    try {
      const reservation = await this.reservationsService.get(reservationId);
      this.openDetail(reservation);
    } catch {
      this.message.error('Rezervasyon bulunamadı');
    }
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    try {
      const [dateFrom, dateTo] = this.dateRangeAsIso();
      const result = await this.reservationsService.list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        villaId: this.filterVillaId() ?? undefined,
        status: this.filterStatus() ?? undefined,
        dateFrom,
        dateTo,
        search: this.filterSearch().trim() || undefined,
      });
      this.reservations.set(result.data);
      this.total.set(result.total);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * The mobile day panel reads this set as the whole truth for a day — "no arrivals or
   * departures" is an answer, not a clipped view — so it has to be complete. The API caps
   * `limit` at 100, which an unbounded fetch can silently exceed, so the window is narrowed
   * to the visible month and the remaining pages are drained before the signal is published.
   */
  async loadCalendarData(): Promise<void> {
    // Paging the month is a single tap and each month is now several round trips, so an
    // older run can finish last; only the newest one gets to publish.
    const requestId = ++this.calendarRequestId;

    this.calendarLoading.set(true);
    try {
      const [dateFrom, dateTo] = this.calendarRangeAsIso();
      const filters = {
        limit: CALENDAR_PAGE_SIZE,
        villaId: this.filterVillaId() ?? undefined,
        status: this.filterStatus() ?? undefined,
        dateFrom,
        dateTo,
      };

      const first = await this.reservationsService.list({ ...filters, page: 1 });
      const reservations = [...first.data];
      const pageCount = Math.ceil(first.total / CALENDAR_PAGE_SIZE);

      for (let page = 2; page <= pageCount && requestId === this.calendarRequestId; page++) {
        const next = await this.reservationsService.list({ ...filters, page });
        if (next.data.length === 0) break;
        reservations.push(...next.data);
      }

      if (requestId !== this.calendarRequestId) return;
      this.calendarReservations.set(reservations);
    } finally {
      if (requestId === this.calendarRequestId) {
        this.calendarLoading.set(false);
      }
    }
  }

  /**
   * The grid also renders the days either side of the month to fill its first and last week,
   * and the list filter matches on stay *overlap*, so the window is padded by a week at each
   * end — otherwise those visible days come back empty.
   */
  private calendarRangeAsIso(): [string, string] {
    const active = this.activeCalendarDate();
    const from = new Date(active.getFullYear(), active.getMonth(), 1);
    const to = new Date(active.getFullYear(), active.getMonth() + 1, 0);
    return [this.toIsoDate(this.addDays(from, -7)), this.toIsoDate(this.addDays(to, 7))];
  }

  private dateRangeAsIso(): [string | undefined, string | undefined] {
    const range = this.filterDateRange();
    if (!range) return [undefined, undefined];
    return [this.toIsoDate(range[0]), this.toIsoDate(range[1])];
  }

  onDateRangeChange(range: [Date, Date] | null): void {
    this.filterDateRange.set(range);
    this.filterDatePreset.set(null);
    this.onFilterChange();
  }

  onSearchChange(term: string): void {
    this.filterSearch.set(term);
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => this.onFilterChange(), 350);
  }

  setDatePreset(preset: 'today' | 'tomorrow' | 'week' | 'month'): void {
    const today = this.stripToDate(new Date());
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'tomorrow':
        start = this.addDays(today, 1);
        end = this.addDays(today, 1);
        break;
      case 'week': {
        const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
        start = this.addDays(today, -dayOfWeek);
        end = this.addDays(start, 6);
        break;
      }
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
    }

    this.filterDatePreset.set(preset);
    this.filterDateRange.set([start, end]);
    this.onFilterChange();
  }

  clearDateFilter(): void {
    this.filterDatePreset.set(null);
    this.filterDateRange.set(null);
    this.onFilterChange();
  }

  private stripToDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  setViewMode(mode: string | number): void {
    const nextMode = mode === 'calendar' || mode === 'availability' ? mode : 'list';
    this.viewMode.set(nextMode);
    if (nextMode === 'calendar') {
      this.loadCalendarData();
    }
  }

  async searchAvailability(): Promise<void> {
    const value = this.availabilityForm.getRawValue();
    // `invalid` tells the compiler nothing about `dateRange`, so reading the field is what
    // actually establishes it is there — and it covers the same ground as the validity check.
    if (this.availabilityForm.invalid || !value.dateRange) {
      return;
    }

    const [checkIn, checkOut] = value.dateRange;

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
      (reservation) => this.stripTime(this.toLocalDate(reservation.checkIn)) === day,
    );
  }

  checkOutsForDate(date: Date): Reservation[] {
    const day = this.stripTime(date);
    return this.calendarReservations().filter(
      (reservation) => this.stripTime(this.toLocalDate(reservation.checkOut)) === day,
    );
  }

  /**
   * ng-zorro funnels a day tap and a header month/year change into the same `nzSelectChange`
   * — `onDateSelect`, `onYearSelect` and `onMonthSelect` all call one `updateDate` — and
   * `nzPanelChange` only fires on the month/year *mode* toggle, so no output on its own means
   * "the user picked a day". Header navigation is the only one of the two that keeps the
   * day-of-month while moving the month or year, which separates them well enough: paging the
   * month must not silently rewrite the day panel underneath the grid. (Tapping a trailing
   * cell that happens to share the selected day-of-month reads as navigation — the panel
   * holds its date instead of following, which is the safe way to be wrong here.)
   */
  onCalendarSelect(date: Date): void {
    const previous = this.activeCalendarDate();
    this.activeCalendarDate.set(date);

    const movedMonth =
      date.getMonth() !== previous.getMonth() || date.getFullYear() !== previous.getFullYear();

    if (!(movedMonth && date.getDate() === previous.getDate())) {
      this.selectedCalendarDate.set(date);
    }

    // The fetch window follows the visible month, so a new month needs its own data.
    if (movedMonth) {
      this.loadCalendarData();
    }
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

  /** A conflicted queue item was picked in the sync panel — reopen the matching form pre-filled
   *  with what the user originally submitted, so they can review and resubmit online. */
  private async handleResolveTarget(item: SyncOutboxItem): Promise<void> {
    try {
      switch (item.type) {
        case 'create-reservation':
          await this.resolveCreateConflict(item);
          break;
        case 'update-reservation':
          await this.resolveUpdateConflict(item);
          break;
        case 'cancel-reservation':
          await this.resolveCancelConflict(item);
          break;
      }
    } finally {
      this.syncQueueStore.clearResolveTarget();
    }
  }

  private async resolveCreateConflict(item: SyncOutboxItem): Promise<void> {
    const payload = item.payload as CreateReservationInput;

    await this.openCreateModal();
    this.form.patchValue({
      villaId: payload.villaId,
      customerId: payload.customerId,
      dateRange: [this.toLocalDate(payload.checkIn), this.toLocalDate(payload.checkOut)],
      guestCount: payload.guestCount,
      notes: payload.notes ?? '',
    });
    await this.onVillaChange(payload.villaId);
    this.form.patchValue({ floorId: payload.floorId });

    if (!this.customerOptions().some((customer) => customer.id === payload.customerId)) {
      try {
        const customer = await this.customersService.get(payload.customerId);
        this.customerOptions.set([customer, ...this.customerOptions()]);
      } catch {
        // Customer may have been removed since — user can search and reselect.
      }
    }

    if (item.conflictingReservationId) {
      try {
        const conflicting = await this.reservationsService.get(item.conflictingReservationId);
        this.message.warning(
          `Bu tarihler ${conflicting.reservationNumber} numaralı rezervasyon (${conflicting.customer.firstName} ${conflicting.customer.lastName}) ile çakışıyor. Lütfen tarihleri güncelleyin.`,
        );
      } catch {
        this.message.warning(
          'Bu rezervasyon başka bir kayıtla çakışıyor. Lütfen tarihleri kontrol edin.',
        );
      }
    } else {
      this.message.warning('Rezervasyon oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.');
    }
  }

  private async resolveUpdateConflict(item: SyncOutboxItem): Promise<void> {
    const targetId = item.targetReservationId;
    if (!targetId) {
      return;
    }

    try {
      const reservation = await this.reservationsService.get(targetId);
      const payload = item.payload as UpdateReservationPayload;
      this.openEditModal(reservation);
      this.editForm.patchValue({
        guestCount: payload.guestCount ?? reservation.guestCount,
        notes: payload.notes ?? reservation.notes ?? '',
      });
      this.message.warning(
        'Bu rezervasyon aradan başka biri tarafından güncellenmiş. Bilgileri kontrol edip tekrar kaydedin.',
      );
    } catch {
      this.message.error('Rezervasyon bulunamadı, muhtemelen silinmiş.');
    }
  }

  private async resolveCancelConflict(item: SyncOutboxItem): Promise<void> {
    const targetId = item.targetReservationId;
    if (!targetId) {
      return;
    }

    try {
      const reservation = await this.reservationsService.get(targetId);
      this.openDetail(reservation);
      this.message.warning('Rezervasyon iptal edilemedi. Güncel durumunu kontrol edin.');
    } catch {
      this.message.error('Rezervasyon bulunamadı, muhtemelen silinmiş.');
    }
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
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.dateRange) {
      return;
    }

    const [checkIn, checkOut] = value.dateRange;

    this.modalSaving.set(true);
    try {
      const result = await this.reservationsService.create(
        {
          customerId: value.customerId,
          villaId: value.villaId,
          floorId: value.floorId,
          checkIn: this.toIsoDate(checkIn),
          checkOut: this.toIsoDate(checkOut),
          guestCount: value.guestCount,
          notes: value.notes || undefined,
        },
        this.buildReservationSummary(value.villaId, value.floorId, value.customerId),
      );

      this.message.success(
        result.queued
          ? 'Çevrimdışısınız — rezervasyon bağlantı kurulunca senkronize edilecek'
          : 'Rezervasyon oluşturuldu',
      );
      this.modalVisible.set(false);
      await this.loadPage();
      if (this.viewMode() === 'calendar') {
        await this.loadCalendarData();
      } else if (this.viewMode() === 'availability' && this.availabilityResults()) {
        await this.searchAvailability();
      }
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
  }

  canEdit(status: ReservationStatus): boolean {
    return status !== 'Cancelled' && status !== 'Completed';
  }

  queueTagFor(reservationId: string): { text: string; color: string } | null {
    const item = this.syncQueueStore
      .items()
      .find((i) => i.targetReservationId === reservationId && i.type !== 'create-reservation');
    if (!item) {
      return null;
    }
    if (item.status === 'conflict') {
      return { text: 'Kontrol gerekiyor', color: 'red' };
    }
    return {
      text: item.type === 'cancel-reservation' ? 'İptal bekliyor' : 'Senkronize bekliyor',
      color: 'blue',
    };
  }

  openEditModal(reservation: Reservation): void {
    this.editingReservation.set(reservation);
    this.editForm.reset({
      guestCount: reservation.guestCount,
      notes: reservation.notes ?? '',
    });
    this.detailVisible.set(false);
    this.editModalVisible.set(true);
  }

  async saveEdit(): Promise<void> {
    const reservation = this.editingReservation();
    if (this.editForm.invalid || !reservation) {
      return;
    }

    const value = this.editForm.getRawValue();

    this.editModalSaving.set(true);
    try {
      const result = await this.reservationsService.update(reservation, {
        guestCount: value.guestCount,
        notes: value.notes || undefined,
      });

      this.message.success(
        result.queued
          ? 'Çevrimdışısınız — değişiklik bağlantı kurulunca senkronize edilecek'
          : 'Rezervasyon güncellendi',
      );
      this.editModalVisible.set(false);
      await this.loadPage();
      if (this.viewMode() === 'calendar') {
        await this.loadCalendarData();
      }
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.editModalSaving.set(false);
    }
  }

  async runAction(reservation: Reservation, action: string): Promise<void> {
    try {
      const result = await this.reservationsService.transition(
        reservation,
        action as ReservationAction,
      );
      this.message.success(
        result.queued
          ? 'Çevrimdışısınız — işlem bağlantı kurulunca senkronize edilecek'
          : 'Durum güncellendi',
      );
      this.detailVisible.set(false);
      await this.loadPage();
      if (this.viewMode() === 'calendar') {
        await this.loadCalendarData();
      }
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    }
  }

  async remove(reservation: Reservation): Promise<void> {
    try {
      await this.reservationsService.remove(reservation.id);
      this.message.success('Rezervasyon silindi');
      await this.loadPage();
      if (this.viewMode() === 'calendar') {
        await this.loadCalendarData();
      }
    } catch (error) {
      // The API refuses an in-stay or paid reservation with a reason worth reading, so the
      // server's message is surfaced rather than a generic "silinemedi".
      this.message.error(this.extractErrorMessage(error));
    }
  }

  private stripTime(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  /**
   * checkIn/checkOut are calendar dates in the database (`@db.Date`) but travel as an
   * instant — midnight UTC. `new Date(...)` on that gives a moment, and every comparison on
   * this page reads it back with local getters, which lands on the day before anywhere west
   * of UTC: an arrival on the 10th would file itself under the 9th. Turkey is UTC+3 so it
   * reads correctly today; taking the date part as written and rebuilding it locally is what
   * makes that true by construction rather than by luck.
   */
  private toLocalDate(isoDate: string): Date {
    const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private buildReservationSummary(villaId: string, floorId: string, customerId: string): string {
    const villaName = this.villas().find((villa) => villa.id === villaId)?.name ?? 'Villa';
    const floorName = this.formFloors().find((floor) => floor.id === floorId)?.name;
    const customerName =
      this.selectedCustomerName() ??
      (() => {
        const customer = this.customerOptions().find((c) => c.id === customerId);
        return customer ? `${customer.firstName} ${customer.lastName}` : 'Müşteri';
      })();
    return floorName
      ? `${villaName} / ${floorName} · ${customerName}`
      : `${villaName} · ${customerName}`;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
