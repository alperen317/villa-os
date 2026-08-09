import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Turns an API failure into a sentence for the user.
 *
 * The API answers with a stable `code` rather than prose precisely so the
 * wording can live here, in the string catalogue, and change with the selected
 * language. A code with no entry falls back to the generic message instead of
 * leaking the server's English text into a Turkish screen.
 */
@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  private readonly translate = inject(TranslateService);

  message(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return this.translate.instant('error.unknown');
    }

    // status 0 is the browser refusing or failing to make the request at all —
    // offline, DNS, CORS — where a server-side code was never produced.
    if (error.status === 0) {
      return this.translate.instant('error.network');
    }

    if (error.status === 429) {
      return this.translate.instant('auth.login.throttled');
    }

    const code = this.codeOf(error);
    if (!code) {
      return this.translate.instant('error.unknown');
    }

    const key = `error.${code}`;
    const translated = this.translate.instant(key);

    // ngx-translate echoes the key back when it has no entry for it.
    return translated === key ? this.translate.instant('error.unknown') : translated;
  }

  /** The machine-readable code, when the body carries one. */
  codeOf(error: HttpErrorResponse): string | null {
    const body = error.error as { code?: unknown } | null;
    return typeof body?.code === 'string' ? body.code : null;
  }
}
