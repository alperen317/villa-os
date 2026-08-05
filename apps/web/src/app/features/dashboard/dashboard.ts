import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth/auth.service';
import { ReportList } from '../reports/report-list/report-list';
import { DashboardService } from './dashboard.service';

interface StatCard {
  label: string;
  value: string;
  icon: string;
  link: string;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzTagModule,
    ReportList,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  protected readonly loadingUser = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly statsLoading = signal(true);
  protected readonly stats = signal<StatCard[]>([]);

  protected readonly pingStatus = signal<number | null>(null);
  protected readonly pinging = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadUser();
    await this.loadStats();
  }

  private async loadUser(): Promise<void> {
    if (this.authService.currentUser()) {
      return;
    }

    this.loadingUser.set(true);
    try {
      await this.authService.loadCurrentUser();
    } catch {
      this.errorMessage.set('Oturum bilgisi alınamadı, lütfen tekrar giriş yapın.');
    } finally {
      this.loadingUser.set(false);
    }
  }

  private async loadStats(): Promise<void> {
    this.statsLoading.set(true);
    try {
      const summary = await this.dashboardService.getSummary();

      this.stats.set([
        {
          label: 'Bugünkü Girişler',
          value: String(summary.todayArrivals),
          icon: 'login',
          link: '/villas',
          queryParams: { arrivingToday: 'true' },
        },
        { label: 'Bugünkü Çıkışlar', value: String(summary.todayDepartures), icon: 'logout', link: '/reservations' },
        { label: 'Şu An Konaklayan', value: String(summary.currentGuests), icon: 'user', link: '/reservations' },
        {
          label: 'Doluluk Oranı',
          value: `%${summary.occupancyRate} (${summary.occupiedVillas}/${summary.totalActiveVillas})`,
          icon: 'home',
          link: '/villas',
        },
        {
          label: 'Bu Ay Gelir',
          value: `${summary.revenueThisMonth.toLocaleString('tr-TR')} ₺`,
          icon: 'dollar',
          link: '/reservations',
        },
        { label: 'Bekleyen Temizlik', value: String(summary.openCleaningTasks), icon: 'clear', link: '/housekeeping' },
        { label: 'Bekleyen Bakım', value: String(summary.openMaintenanceTasks), icon: 'tool', link: '/villas' },
      ]);
    } finally {
      this.statsLoading.set(false);
    }
  }

  async testConnection(): Promise<void> {
    this.pinging.set(true);
    try {
      this.pingStatus.set(await this.authService.ping());
    } finally {
      this.pinging.set(false);
    }
  }
}
