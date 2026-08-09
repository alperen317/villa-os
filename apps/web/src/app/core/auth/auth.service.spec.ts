import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../api-base-url';

const ADMIN = { sub: 'user-1', username: 'admin', role: 'Administrator' as const };

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts out unauthenticated — the session is a cookie the app cannot read', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  describe('login', () => {
    it('adopts the user the server returns, without ever seeing a token', async () => {
      const pending = service.login('admin', 'secret');

      const request = http.expectOne(`${API_BASE_URL}/auth/login`);
      expect(request.request.body).toEqual({ username: 'admin', password: 'secret' });
      request.flush(ADMIN);
      await pending;

      expect(service.currentUser()).toEqual(ADMIN);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('does not claim a session when the credentials are rejected', async () => {
      const pending = service.login('admin', 'wrong');
      http.expectOne(`${API_BASE_URL}/auth/login`).flush(
        { code: 'AUTH_INVALID_CREDENTIALS' },
        { status: 401, statusText: 'Unauthorized' },
      );

      await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('ensureSessionLoaded', () => {
    it('resolves to a signed-in state when /auth/me answers', async () => {
      const pending = service.ensureSessionLoaded();
      http.expectOne(`${API_BASE_URL}/auth/me`).flush(ADMIN);
      await pending;

      expect(service.currentUser()).toEqual(ADMIN);
    });

    it('treats a 401 as "nobody is signed in" rather than an error', async () => {
      const pending = service.ensureSessionLoaded();
      http.expectOne(`${API_BASE_URL}/auth/me`).flush(null, { status: 401, statusText: 'Unauthorized' });

      // Must not reject: guards await this to decide where to navigate.
      await expect(pending).resolves.toBeUndefined();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('probes once even when several guards ask at the same time', async () => {
      const first = service.ensureSessionLoaded();
      const second = service.ensureSessionLoaded();

      http.expectOne(`${API_BASE_URL}/auth/me`).flush(ADMIN);
      await Promise.all([first, second]);

      // expectOne already fails on a second request; verify() catches any extra.
      expect(service.currentUser()).toEqual(ADMIN);
    });

    it('asks again after the session is cleared', async () => {
      const first = service.ensureSessionLoaded();
      http.expectOne(`${API_BASE_URL}/auth/me`).flush(ADMIN);
      await first;

      service.clearSession();

      const second = service.ensureSessionLoaded();
      http.expectOne(`${API_BASE_URL}/auth/me`).flush(ADMIN);
      await second;
    });
  });

  describe('refreshSession', () => {
    it('sends no body — the token being rotated is in the cookie', async () => {
      const pending = service.refreshSession();

      const request = http.expectOne(`${API_BASE_URL}/auth/refresh`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      request.flush(null, { status: 204, statusText: 'No Content' });

      await pending;
    });

    it('collapses concurrent refreshes into one request', async () => {
      const first = service.refreshSession();
      const second = service.refreshSession();

      http.expectOne(`${API_BASE_URL}/auth/refresh`).flush(null, { status: 204, statusText: 'No Content' });
      await Promise.all([first, second]);
    });

    it('clears the session when the refresh token is no longer valid', async () => {
      const pending = service.ensureSessionLoaded();
      http.expectOne(`${API_BASE_URL}/auth/me`).flush(ADMIN);
      await pending;

      const refresh = service.refreshSession();
      http.expectOne(`${API_BASE_URL}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

      await expect(refresh).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('allows a new refresh after a failed one', async () => {
      const first = service.refreshSession();
      http.expectOne(`${API_BASE_URL}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
      await expect(first).rejects.toBeInstanceOf(HttpErrorResponse);

      const second = service.refreshSession();
      http.expectOne(`${API_BASE_URL}/auth/refresh`).flush(null, { status: 204, statusText: 'No Content' });
      await second;
    });
  });

  describe('logout', () => {
    it('drops local state before the request, so the UI cannot flash signed-in', async () => {
      const load = service.ensureSessionLoaded();
      http.expectOne(`${API_BASE_URL}/auth/me`).flush(ADMIN);
      await load;

      const pending = service.logout();
      expect(service.isAuthenticated()).toBe(false);

      http.expectOne(`${API_BASE_URL}/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
      await pending;
    });
  });
});
