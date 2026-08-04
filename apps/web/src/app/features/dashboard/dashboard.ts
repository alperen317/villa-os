import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth/auth.service';
import { CustomersService } from '../customers/customers.service';
import { ReservationsService } from '../reservations/reservations.service';
import { VillasService } from '../villas/villas.service';

interface StatCard {
  label: string;
  value: number;
  icon: string;
  link: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, NzAlertModule, NzButtonModule, NzCardModule, NzIconModule, NzSpinModule, NzTagModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly villasService = inject(VillasService);
  private readonly reservationsService = inject(ReservationsService);
  private readonly customersService = inject(CustomersService);

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
      const [villas, pendingReservations, activeReservations, customerCount] = await Promise.all([
        this.villasService.list({ limit: 1 }),
        this.reservationsService.list({ limit: 1, status: 'Pending' }),
        this.reservationsService.list({ limit: 1, status: 'Confirmed' }),
        this.customersService.count(),
      ]);

      this.stats.set([
        { label: 'Toplam Villa', value: villas.total, icon: 'home', link: '/villas' },
        { label: 'Bekleyen Rezervasyon', value: pendingReservations.total, icon: 'clock-circle', link: '/reservations' },
        { label: 'Onaylanmış Rezervasyon', value: activeReservations.total, icon: 'check-circle', link: '/reservations' },
        { label: 'Kayıtlı Müşteri', value: customerCount, icon: 'user', link: '/reservations' },
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
