import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { CurrentUser } from './auth.model';

/**
 * The session lives in httpOnly cookies the browser attaches on its own, so
 * this service never sees a token. That is the point — script on the page
 * cannot read one either, so an XSS can no longer steal a session and replay it
 * elsewhere. The consequence is that "am I signed in?" becomes a question only
 * the server can answer, which is what `ensureSessionLoaded` asks.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /** Shared by concurrent 401s so a burst of requests triggers one refresh, not one each. */
  private refreshPromise: Promise<void> | null = null;

  /** Shared by concurrent guards so one navigation probes the session once. */
  private sessionLoad: Promise<void> | null = null;

  async login(username: string, password: string): Promise<void> {
    const user = await firstValueFrom(
      this.http.post<CurrentUser>(`${API_BASE_URL}/auth/login`, { username, password }),
    );
    this.adoptSession(user);
  }

  async checkOnboardingStatus(): Promise<boolean> {
    const result = await firstValueFrom(
      this.http.get<{ needsOnboarding: boolean }>(`${API_BASE_URL}/auth/onboarding-status`),
    );
    return result.needsOnboarding;
  }

  async completeOnboarding(username: string, password: string): Promise<void> {
    const user = await firstValueFrom(
      this.http.post<CurrentUser>(`${API_BASE_URL}/auth/onboarding`, { username, password }),
    );
    this.adoptSession(user);
  }

  async logout(): Promise<void> {
    this.clearSession();
    // No body: the token being revoked is the one in the cookie, and the server
    // clears both cookies as it goes.
    await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/logout`, {}));
  }

  /**
   * Resolves once the session state is known. Safe to await repeatedly — the
   * answer is cached until the session changes.
   */
  ensureSessionLoaded(): Promise<void> {
    this.sessionLoad ??= this.loadCurrentUser().catch(() => {
      // A 401 here is an answer, not a failure: nobody is signed in.
      this.currentUser.set(null);
    });

    return this.sessionLoad;
  }

  async loadCurrentUser(): Promise<void> {
    const user = await firstValueFrom(this.http.get<CurrentUser>(`${API_BASE_URL}/auth/me`));
    this.currentUser.set(user);
  }

  /** Manual connectivity check: resolves the HTTP status (200 authenticated, 401 otherwise). */
  async ping(): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${API_BASE_URL}/auth/ping`, { observe: 'response' }),
      );
      return response.status;
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        return error.status;
      }
      throw error;
    }
  }

  /**
   * Rotates the session using the refresh cookie. Called by the HTTP
   * interceptor when a request comes back 401.
   */
  refreshSession(): Promise<void> {
    this.refreshPromise ??= firstValueFrom(this.http.post(`${API_BASE_URL}/auth/refresh`, {}))
      .then(() => undefined)
      .catch((error: unknown) => {
        this.clearSession();
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  /** Drops local session state without calling the backend (used after a failed refresh). */
  clearSession(): void {
    this.currentUser.set(null);
    this.sessionLoad = null;
  }

  private adoptSession(user: CurrentUser): void {
    this.currentUser.set(user);
    // Already known — a guard need not ask the server again.
    this.sessionLoad = Promise.resolve();
  }
}
