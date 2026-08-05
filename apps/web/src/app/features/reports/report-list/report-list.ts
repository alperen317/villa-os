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
import { VillasStore } from '../../villas/villas.store';
import { ReportsService } from '../reports.service';

const CHART_COLORS = ['#2f54eb', '#13a8a8', '#fa8c16', '#eb2f96', '#52c41a', '#722ed1'];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
  private readonly message = inject(NzMessageService);
  private readonly formBuilder = inject(FormBuilder);

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

  protected readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  protected readonly occupancyChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const report = this.occupancy();
    return {
      labels: report?.daily.map((point) => point.date) ?? [],
      datasets: [
        {
          label: 'Doluluk (%)',
          data: report?.daily.map((point) => point.occupancyRate) ?? [],
          borderColor: CHART_COLORS[0],
          backgroundColor: `${CHART_COLORS[0]}33`,
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
          backgroundColor: CHART_COLORS[1],
        },
      ],
    };
  });

  protected readonly revenueMethodChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const report = this.revenue();
    const rows = report?.byMethod ?? [];
    return {
      labels: rows.map((row) => this.paymentMethodLabels[row.method]),
      datasets: [{ data: rows.map((row) => row.amount), backgroundColor: CHART_COLORS }],
    };
  });

  protected readonly reservationsStatusChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const report = this.reservationsReport();
    const rows = report?.byStatus ?? [];
    return {
      labels: rows.map((row) => this.statusLabels[row.status]),
      datasets: [
        {
          label: 'Rezervasyon Sayısı',
          data: rows.map((row) => row.count),
          backgroundColor: CHART_COLORS[2],
        },
      ],
    };
  });

  protected readonly customersChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const top = (this.customers()?.customers ?? []).slice(0, 10);
    return {
      labels: top.map((row) => row.customerName),
      datasets: [
        {
          label: 'Toplam Harcama',
          data: top.map((row) => row.totalSpent),
          backgroundColor: CHART_COLORS[3],
        },
      ],
    };
  });

  async ngOnInit(): Promise<void> {
    await this.villasStore.ensureLoaded();
    await this.loadActiveReport();
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
