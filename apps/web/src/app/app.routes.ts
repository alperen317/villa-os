import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
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
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
