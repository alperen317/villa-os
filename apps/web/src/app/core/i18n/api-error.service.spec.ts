import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ApiErrorService } from './api-error.service';

const MESSAGES: Record<string, string> = {
  'error.unknown': 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
  'error.network': 'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.',
  'error.RESERVATION_CONFLICT': 'Seçilen tarihler çakışıyor',
  'auth.login.throttled': 'Çok fazla deneme yapıldı.',
};

describe('ApiErrorService', () => {
  let service: ApiErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslateService,
          // ngx-translate echoes the key back when it has no entry, which is
          // exactly the behaviour the service has to cope with.
          useValue: { instant: (key: string) => MESSAGES[key] ?? key },
        },
      ],
    });

    service = TestBed.inject(ApiErrorService);
  });

  function httpError(body: unknown, status: number): HttpErrorResponse {
    return new HttpErrorResponse({ error: body, status, statusText: 'Error' });
  }

  it('translates a known error code', () => {
    expect(service.message(httpError({ code: 'RESERVATION_CONFLICT' }, 409))).toBe(
      'Seçilen tarihler çakışıyor',
    );
  });

  it('falls back to the generic message for a code it has no wording for', () => {
    // Must not leak the API's English `message` into a Turkish screen.
    expect(
      service.message(httpError({ code: 'SOMETHING_NEW', message: 'Raw server text' }, 409)),
    ).toBe(MESSAGES['error.unknown']);
  });

  it('reports a rate-limited caller as such rather than as a generic failure', () => {
    expect(service.message(httpError({}, 429))).toBe(MESSAGES['auth.login.throttled']);
  });

  it('reports status 0 as a connectivity problem', () => {
    expect(service.message(httpError(null, 0))).toBe(MESSAGES['error.network']);
  });

  it('falls back when the body carries no code at all', () => {
    expect(service.message(httpError({ message: 'no code here' }, 500))).toBe(
      MESSAGES['error.unknown'],
    );
  });

  it('handles a non-HTTP failure', () => {
    expect(service.message(new Error('boom'))).toBe(MESSAGES['error.unknown']);
  });

  describe('codeOf', () => {
    it('returns the code when present', () => {
      expect(service.codeOf(httpError({ code: 'VILLA_NOT_FOUND' }, 404))).toBe('VILLA_NOT_FOUND');
    });

    it('returns null when the body is not shaped like an API error', () => {
      expect(service.codeOf(httpError('plain text', 502))).toBeNull();
    });
  });
});
