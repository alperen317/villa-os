import { Route } from '@angular/router';
import { adminGuard, authGuard, guestGuard, onboardingGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/onboarding-page/onboarding-page').then((m) => m.OnboardingPage),
    canActivate: [onboardingGuard],
  },
  {
    path: '',
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'villas',
        loadComponent: () =>
          import('./features/villas/villa-list/villa-list').then((m) => m.VillaList),
      },
      {
        path: 'villas/:id',
        loadComponent: () =>
          import('./features/villas/villa-detail/villa-detail').then((m) => m.VillaDetail),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/reservations/reservation-list/reservation-list').then(
            (m) => m.ReservationList,
          ),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customer-list/customer-list').then((m) => m.CustomerList),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./features/customers/customer-detail/customer-detail').then(
            (m) => m.CustomerDetail,
          ),
      },
      {
        path: 'housekeeping',
        loadComponent: () =>
          import('./features/housekeeping/housekeeping-queue/housekeeping-queue').then(
            (m) => m.HousekeepingQueue,
          ),
      },
      {
        path: 'maintenance',
        loadComponent: () =>
          import('./features/maintenance/maintenance-list/maintenance-list').then(
            (m) => m.MaintenanceList,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page/settings-page').then((m) => m.SettingsPage),
        canActivate: [adminGuard],
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList),
        canActivate: [adminGuard],
      },
    ],
  },
  {
    path: 'not-found',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
  { path: '**', redirectTo: 'not-found' },
];
