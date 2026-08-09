import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Requests to these endpoints never trigger a refresh-and-retry (avoids infinite loops). */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/onboarding'];

/**
 * Endpoints whose whole job is to report whether a session exists. A 401 from
 * one is an answer; bouncing the user to /login over it would fight the guards,
 * which are already deciding where to go.
 */
const SESSION_PROBES = ['/auth/me', '/auth/ping'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // The session cookie is httpOnly, so the app cannot attach it — the browser
  // does, but only for requests that opt into sending credentials.
  const credentialedReq = req.clone({ withCredentials: true });

  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));
  const isSessionProbe = SESSION_PROBES.some((path) => req.url.includes(path));

  return next(credentialedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      // An expired access cookie is the common case: the refresh cookie
      // outlives it, so rotating and retrying keeps the user signed in.
      return from(authService.refreshSession()).pipe(
        switchMap(() => next(credentialedReq)),
        catchError((refreshError: unknown) => {
          authService.clearSession();
          if (!isSessionProbe) {
            router.navigateByUrl('/login');
          }
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
