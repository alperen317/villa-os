import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AuthService } from '../../core/auth/auth.service';

const HOUSEKEEPING_NAV_ROLES = new Set(['Administrator', 'Operations', 'Housekeeping']);

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterModule, NzButtonModule, NzIconModule, NzLayoutModule, NzMenuModule],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly collapsed = signal(false);
  protected readonly mobileNavOpen = signal(false);

  protected readonly showHousekeepingNav = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? HOUSEKEEPING_NAV_ROLES.has(role) : false;
  });

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
