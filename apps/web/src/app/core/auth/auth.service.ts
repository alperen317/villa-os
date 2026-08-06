import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { CurrentUser, TokenPair } from './auth.model';

const ACCESS_TOKEN_KEY = 'villaos.accessToken';
const REFRESH_TOKEN_KEY = 'villaos.refreshToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  readonly refreshToken = signal<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  readonly currentUser = signal<CurrentUser | null>(null);

  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  /** Shared by concurrent 401s so a burst of requests triggers one refresh, not one each. */
  private refreshPromise: Promise<string> | null = null;

  async login(username: string, password: string): Promise<void> {
    const tokens = await firstValueFrom(
      this.http.post<TokenPair>(`${API_BASE_URL}/auth/login`, { username, password }),
    );
    this.setTokens(tokens);
    await this.loadCurrentUser();
  }

  async checkOnboardingStatus(): Promise<boolean> {
    const result = await firstValueFrom(
      this.http.get<{ needsOnboarding: boolean }>(`${API_BASE_URL}/auth/onboarding-status`),
    );
    return result.needsOnboarding;
  }

  async completeOnboarding(username: string, password: string): Promise<void> {
    const tokens = await firstValueFrom(
      this.http.post<TokenPair>(`${API_BASE_URL}/auth/onboarding`, { username, password }),
    );
    this.setTokens(tokens);
    await this.loadCurrentUser();
  }

  async logout(): Promise<void> {
    const refreshToken = this.refreshToken();
    this.clearSession();

    if (refreshToken) {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/logout`, { refreshToken }));
    }
  }

  async loadCurrentUser(): Promise<void> {
    const user = await firstValueFrom(this.http.get<CurrentUser>(`${API_BASE_URL}/auth/me`));
    this.currentUser.set(user);
  }

  /** Manual connectivity check: resolves the HTTP status (200 authenticated, 400 otherwise). */
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
   * Exchanges the stored refresh token for a new access/refresh pair.
   * Called by the HTTP interceptor when a request comes back 401.
   */
  refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.refreshToken();
    if (!refreshToken) {
      this.clearSession();
      return Promise.reject(new Error('No refresh token available'));
    }

    this.refreshPromise = firstValueFrom(
      this.http.post<TokenPair>(`${API_BASE_URL}/auth/refresh`, { refreshToken }),
    )
      .then((tokens) => {
        this.setTokens(tokens);
        return tokens.accessToken;
      })
      .catch((error) => {
        this.clearSession();
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  /** Clears local session state without calling the backend (used after a failed refresh). */
  clearSession(): void {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.currentUser.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private setTokens(tokens: TokenPair): void {
    this.accessToken.set(tokens.accessToken);
    this.refreshToken.set(tokens.refreshToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}
