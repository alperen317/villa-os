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
