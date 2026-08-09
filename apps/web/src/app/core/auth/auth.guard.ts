import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Every guard awaits `ensureSessionLoaded` first: the session is an httpOnly
 * cookie, so on a fresh page load the app does not know whether it is signed in
 * until the server says so. The call is shared, so a navigation running several
 * guards still probes once.
 */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router); // must be injected before any `await` — inject() needs the active injection context

  await authService.ensureSessionLoaded();

  return authService.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/**
 * Keeps an already-authenticated user off the login screen (e.g. opened in a new tab),
 * and sends a fresh install (no users yet) to onboarding instead of an unusable login form.
 */
export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureSessionLoaded();

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

  await authService.ensureSessionLoaded();

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  const needsOnboarding = await authService.checkOnboardingStatus();
  return needsOnboarding ? true : router.createUrlTree(['/login']);
};

/**
 * Restricts a route to Administrators (e.g. whitelabel/branding settings).
 * `ensureSessionLoaded` also populates `currentUser`, so the role is known here
 * even on a fresh navigation straight into the route.
 */
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureSessionLoaded();

  if (authService.currentUser()?.role === 'Administrator') {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
