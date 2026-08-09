import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../api-base-url';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let router: { navigateByUrl: jest.Mock };

  beforeEach(() => {
    router = { navigateByUrl: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  /**
   * The retry is dispatched from a promise continuation, so it does not exist
   * yet in the turn that flushed the refresh response.
   */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('sends credentials so the browser attaches the session cookie', async () => {
    const pending = firstValueFrom(client.get(`${API_BASE_URL}/villas`));

    const request = http.expectOne(`${API_BASE_URL}/villas`);
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);

    await pending;
  });

  it('never sends an Authorization header — there is no token to put in one', async () => {
    const pending = firstValueFrom(client.get(`${API_BASE_URL}/villas`));

    const request = http.expectOne(`${API_BASE_URL}/villas`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);

    await pending;
  });

  it('refreshes and retries once when a request comes back 401', async () => {
    const pending = firstValueFrom(client.get(`${API_BASE_URL}/villas`));

    http.expectOne(`${API_BASE_URL}/villas`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API_BASE_URL}/auth/refresh`).flush(null, { status: 204, statusText: 'No Content' });

    await settle();
    http.expectOne(`${API_BASE_URL}/villas`).flush([{ id: 'villa-1' }]);

    await expect(pending).resolves.toEqual([{ id: 'villa-1' }]);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('sends the user to /login when the refresh also fails', async () => {
    const pending = firstValueFrom(client.get(`${API_BASE_URL}/villas`));

    http.expectOne(`${API_BASE_URL}/villas`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API_BASE_URL}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });

  it('does not try to refresh a failed login — that would loop', async () => {
    const pending = firstValueFrom(client.post(`${API_BASE_URL}/auth/login`, {}));

    http.expectOne(`${API_BASE_URL}/auth/login`).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    // expectNone would also be satisfied by verify(), but state it outright.
    http.expectNone(`${API_BASE_URL}/auth/refresh`);
  });

  it('does not redirect when a session probe fails — the guards decide that', async () => {
    const pending = firstValueFrom(client.get(`${API_BASE_URL}/auth/me`));

    http.expectOne(`${API_BASE_URL}/auth/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API_BASE_URL}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('leaves non-401 failures alone', async () => {
    const pending = firstValueFrom(client.get(`${API_BASE_URL}/villas`));

    http.expectOne(`${API_BASE_URL}/villas`).flush(null, { status: 500, statusText: 'Server Error' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    http.expectNone(`${API_BASE_URL}/auth/refresh`);
  });
});
