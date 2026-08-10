import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { SyncQueuePanel } from '../../core/sync/sync-queue-panel/sync-queue-panel';
import { TourService } from '../../core/tour/tour.service';
import { SettingsStore } from '../../features/settings/settings.store';

const HOUSEKEEPING_NAV_ROLES = new Set(['Administrator', 'Operations', 'Housekeeping']);

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterModule,
    NzButtonModule,
    NzIconModule,
    NzLayoutModule,
    NzMenuModule,
    SyncQueuePanel,
    TranslatePipe,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly settingsStore = inject(SettingsStore);
  protected readonly tourService = inject(TourService);
  private readonly router = inject(Router);

  protected readonly collapsed = signal(false);
  protected readonly mobileNavOpen = signal(false);

  protected readonly showHousekeepingNav = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? HOUSEKEEPING_NAV_ROLES.has(role) : false;
  });

  protected readonly showAdminNav = computed(
    () => this.authService.currentUser()?.role === 'Administrator',
  );

  constructor() {
    // Close the off-canvas drawer once navigation actually happens, rather than on a click
    // anywhere in the menu — this also covers keyboard activation and programmatic navigation
    // (e.g. the guided tour), and keeps the <ul> free of a non-keyboard-accessible handler.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mobileNavOpen.set(false));
  }

  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser()) {
      await this.authService.loadCurrentUser();
    }

    const user = this.authService.currentUser();
    if (user && !this.tourService.hasSeenTour(user.sub)) {
      void this.tourService.start();
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}
