import { CookieOptions, Request, Response } from 'express';
import { TokenPair } from './auth.service';

export const ACCESS_TOKEN_COOKIE = 'villaos_access_token';
export const REFRESH_TOKEN_COOKIE = 'villaos_refresh_token';

/**
 * Tokens live in cookies rather than in a body the front-end has to store.
 *
 * `httpOnly` is the point: script on the page cannot read the value, so an XSS
 * cannot exfiltrate a token and replay it later from somewhere else. (It does
 * not make XSS harmless — the browser still attaches the cookie to same-origin
 * requests the injected script makes — but it removes the durable theft.)
 *
 * `sameSite: 'strict'` is what stands in for a CSRF token: the deployment is
 * same-origin behind nginx, so no legitimate cross-site request needs these
 * cookies, and the browser will not attach them to one.
 *
 * `secure` is off outside production because browsers drop Secure cookies on
 * plain-http localhost, which would make `nx serve` unusable.
 */
function cookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setAuthCookies(response: Response, tokens: TokenPair, ttl: TokenTtl): void {
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions(ttl.accessSeconds));
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions(ttl.refreshSeconds));
}

export function clearAuthCookies(response: Response): void {
  // Same attributes as when set, minus maxAge — a cookie only clears when the
  // attributes match the ones it was written with.
  const { maxAge: _maxAge, ...attributes } = cookieOptions(0);
  response.clearCookie(ACCESS_TOKEN_COOKIE, attributes);
  response.clearCookie(REFRESH_TOKEN_COOKIE, attributes);
}

export function readAccessToken(request: Request): string | undefined {
  return readCookie(request, ACCESS_TOKEN_COOKIE) ?? readBearerToken(request);
}

export function readRefreshToken(request: Request): string | undefined {
  return readCookie(request, REFRESH_TOKEN_COOKIE);
}

function readCookie(request: Request, name: string): string | undefined {
  const value = (request as Request & { cookies?: Record<string, unknown> }).cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Kept as a fallback so Swagger's "Authorize" button still works. It costs
 * nothing security-wise: a caller can only send a bearer token it already has,
 * and page script can no longer obtain one.
 */
function readBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

export interface TokenTtl {
  accessSeconds: number;
  refreshSeconds: number;
}
