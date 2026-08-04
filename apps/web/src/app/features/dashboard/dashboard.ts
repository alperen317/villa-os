import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzIconModule,
    NzSpinModule,
    NzTagModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly pingStatus = signal<number | null>(null);
  protected readonly pinging = signal(false);

  async ngOnInit(): Promise<void> {
    if (this.authService.currentUser()) {
      return;
    }

    this.loading.set(true);
    try {
      // Exercises GET /api/v1/auth/me with the stored access token.
      await this.authService.loadCurrentUser();
    } catch {
      this.errorMessage.set('Oturum bilgisi alınamadı, lütfen tekrar giriş yapın.');
    } finally {
      this.loading.set(false);
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

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}
