import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CustomersReport,
  OccupancyReport,
  PAYMENT_METHOD_LABELS,
  ReportQuery,
  ReservationsReport,
  RevenueReport,
} from '../../../core/models/report.model';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
} from '../../../core/models/reservation.model';
import { SettingsStore } from '../../settings/settings.store';
import { VillasStore } from '../../villas/villas.store';
import { ReportsService } from '../reports.service';

const DEFAULT_ACCENT_COLOR = '#2563eb';
/** First slot tracks the live brand accent color; the rest stay fixed for category contrast (e.g. the payment-method doughnut). */
const FIXED_CHART_COLORS = ['#13a8a8', '#fa8c16', '#eb2f96', '#52c41a', '#722ed1'];

type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear';

function stripToDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    BaseChartDirective,
    NzButtonModule,
    NzDatePickerModule,
    NzFormModule,
    NzSelectModule,
    NzSkeletonModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  templateUrl: './report-list.html',
  styleUrl: './report-list.scss',
})
export class ReportList implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly villasStore = inject(VillasStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly message = inject(NzMessageService);
  private readonly formBuilder = inject(FormBuilder);

  /** [live brand accent, ...fixed category colors] — recomputes whenever the accent color changes in Settings. */
  protected readonly chartColors = computed(() => [
    this.settingsStore.settings()?.accentColor || DEFAULT_ACCENT_COLOR,
    ...FIXED_CHART_COLORS,
  ]);

  protected readonly statusLabels = RESERVATION_STATUS_LABELS;
  protected readonly statusColors = RESERVATION_STATUS_COLORS;
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;

  protected readonly villas = this.villasStore.villas;
  protected readonly tabIndex = signal(0);
  protected readonly loading = signal(false);

  protected readonly occupancy = signal<OccupancyReport | null>(null);
  protected readonly revenue = signal<RevenueReport | null>(null);
  protected readonly reservationsReport = signal<ReservationsReport | null>(null);
  protected readonly customers = signal<CustomersReport | null>(null);

  private readonly loadedTabs = new Set<number>();

  protected readonly filterForm = this.formBuilder.nonNullable.group({
    dateRange: [[startOfMonth(new Date()), new Date()] as [Date, Date], Validators.required],
    villaId: [''],
  });

  protected readonly filterDatePreset = signal<DatePreset | null>('thisMonth');

  protected readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  protected readonly occupancyChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const report = this.occupancy();
    const [accent] = this.chartColors();
    return {
      labels: report?.daily.map((point) => point.date) ?? [],
      datasets: [
        {
          label: 'Doluluk (%)',
          data: report?.daily.map((point) => point.occupancyRate) ?? [],
          borderColor: accent,
          backgroundColor: `${accent}33`,
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  protected readonly revenueDailyChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const report = this.revenue();
    return {
      labels: report?.daily.map((point) => point.date) ?? [],
      datasets: [
        {
          label: 'Gelir',
          data: report?.daily.map((point) => point.amount) ?? [],
          backgroundColor: this.chartColors()[0],
        },
      ],
    };
  });

  protected readonly revenueMethodChartData = computed<ChartConfiguration<'doughnut'>['data']>(
    () => {
      const report = this.revenue();
      const rows = report?.byMethod ?? [];
      return {
        labels: rows.map((row) => this.paymentMethodLabels[row.method]),
        datasets: [{ data: rows.map((row) => row.amount), backgroundColor: this.chartColors() }],
      };
    },
  );

  protected readonly reservationsStatusChartData = computed<ChartConfiguration<'bar'>['data']>(
    () => {
      const report = this.reservationsReport();
      const rows = report?.byStatus ?? [];
      return {
        labels: rows.map((row) => this.statusLabels[row.status]),
        datasets: [
          {
            label: 'Rezervasyon Sayısı',
            data: rows.map((row) => row.count),
            backgroundColor: this.chartColors()[0],
          },
        ],
      };
    },
  );

  protected readonly customersChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const top = (this.customers()?.customers ?? []).slice(0, 10);
    return {
      labels: top.map((row) => row.customerName),
      datasets: [
        {
          label: 'Toplam Harcama',
          data: top.map((row) => row.totalSpent),
          backgroundColor: this.chartColors()[0],
        },
      ],
    };
  });

  async ngOnInit(): Promise<void> {
    // Manual edits to the range picker (not routed through setDatePreset) should
    // drop the active preset highlight — setDatePreset re-sets it right after
    // its own setValue call, so this only fires for genuinely manual changes.
    this.filterForm.controls.dateRange.valueChanges.subscribe(() =>
      this.filterDatePreset.set(null),
    );

    await this.villasStore.ensureLoaded();
    await this.loadActiveReport();
  }

  setDatePreset(preset: DatePreset): void {
    const today = stripToDate(new Date());
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'last7':
        start = addDays(today, -6);
        end = today;
        break;
      case 'last30':
        start = addDays(today, -29);
        end = today;
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = today;
        break;
      case 'lastMonth': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      }
      case 'thisYear':
        start = startOfYear(today);
        end = today;
        break;
    }

    this.filterForm.controls.dateRange.setValue([start, end]);
    this.filterDatePreset.set(preset);
    this.onFilterApply();
  }

  onTabIndexChange(index: number): void {
    this.tabIndex.set(index);
    if (!this.loadedTabs.has(index)) {
      this.loadActiveReport();
    }
  }

  onFilterApply(): void {
    if (this.filterForm.invalid) {
      return;
    }
    this.loadedTabs.clear();
    this.loadActiveReport();
  }

  async loadActiveReport(): Promise<void> {
    if (this.filterForm.invalid) {
      return;
    }

    const index = this.tabIndex();
    const query = this.buildQuery();

    this.loading.set(true);
    try {
      if (index === 0) {
        this.occupancy.set(await this.reportsService.getOccupancy(query));
      } else if (index === 1) {
        this.revenue.set(await this.reportsService.getRevenue(query));
      } else if (index === 2) {
        this.reservationsReport.set(await this.reportsService.getReservations(query));
      } else {
        this.customers.set(await this.reportsService.getCustomers(query));
      }
      this.loadedTabs.add(index);
    } catch {
      this.message.error('Rapor alınamadı');
    } finally {
      this.loading.set(false);
    }
  }

  protected currency(value: number): string {
    return `${value.toLocaleString('tr-TR')} ₺`;
  }

  private buildQuery(): ReportQuery {
    const value = this.filterForm.getRawValue();
    const [from, to] = value.dateRange;
    return {
      from: toIsoDate(from),
      to: toIsoDate(addDays(to, 1)),
      villaId: value.villaId || undefined,
    };
  }
}
