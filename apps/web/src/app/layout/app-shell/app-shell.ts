import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AuthService } from '../../core/auth/auth.service';
import { SyncQueuePanel } from '../../core/sync/sync-queue-panel/sync-queue-panel';
import { SettingsStore } from '../../features/settings/settings.store';

const HOUSEKEEPING_NAV_ROLES = new Set(['Administrator', 'Operations', 'Housekeeping']);

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterModule, NzButtonModule, NzIconModule, NzLayoutModule, NzMenuModule, SyncQueuePanel],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly settingsStore = inject(SettingsStore);
  private readonly router = inject(Router);

  protected readonly collapsed = signal(false);
  protected readonly mobileNavOpen = signal(false);

  protected readonly showHousekeepingNav = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? HOUSEKEEPING_NAV_ROLES.has(role) : false;
  });

  protected readonly showSettingsNav = computed(
    () => this.authService.currentUser()?.role === 'Administrator',
  );

  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser()) {
      await this.authService.loadCurrentUser();
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }
}
