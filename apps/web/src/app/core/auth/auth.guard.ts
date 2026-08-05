import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (authService.isAuthenticated()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login']);
};

/** Keeps an already-authenticated user off the login screen (e.g. opened in a new tab). */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (!authService.isAuthenticated()) {
    return true;
  }

  return inject(Router).createUrlTree(['/dashboard']);
};

/**
 * Restricts a route to Administrators (e.g. whitelabel/branding settings).
 * Runs before AppShell.ngOnInit, so on a fresh navigation `currentUser` may
 * not be populated yet — load it here rather than assume it's already set.
 */
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  if (!authService.currentUser()) {
    await authService.loadCurrentUser();
  }

  if (authService.currentUser()?.role === 'Administrator') {
    return true;
  }

  return inject(Router).createUrlTree(['/dashboard']);
};
