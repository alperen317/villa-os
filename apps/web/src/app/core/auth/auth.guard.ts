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

/**
 * Keeps an already-authenticated user off the login screen (e.g. opened in a new tab),
 * and sends a fresh install (no users yet) to onboarding instead of an unusable login form.
 */
export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router); // must be injected before any `await` — inject() needs the active injection context

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  const needsOnboarding = await authService.checkOnboardingStatus();
  return needsOnboarding ? router.createUrlTree(['/onboarding']) : true;
};

/** Restricts the first-admin setup screen to systems that don't have any users yet. */
export const onboardingGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  const needsOnboarding = await authService.checkOnboardingStatus();
  return needsOnboarding ? true : router.createUrlTree(['/login']);
};

/**
 * Restricts a route to Administrators (e.g. whitelabel/branding settings).
 * Runs before AppShell.ngOnInit, so on a fresh navigation `currentUser` may
 * not be populated yet — load it here rather than assume it's already set.
 */
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.currentUser()) {
    await authService.loadCurrentUser();
  }

  if (authService.currentUser()?.role === 'Administrator') {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
