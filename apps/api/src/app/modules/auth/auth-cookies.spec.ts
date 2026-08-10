import { Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  readAccessToken,
  readRefreshToken,
  setAuthCookies,
} from './auth-cookies';

function responseSpy() {
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  return { spy: { cookie, clearCookie } as unknown as Response, cookie, clearCookie };
}

function requestWith(cookies: Record<string, string>, authorization?: string): Request {
  return { cookies, headers: authorization ? { authorization } : {} } as unknown as Request;
}

describe('auth cookies', () => {
  const tokens = { accessToken: 'access.jwt', refreshToken: 'refresh.jwt' };
  const ttl = { accessSeconds: 900, refreshSeconds: 604_800 };
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('setAuthCookies', () => {
    it('marks both cookies httpOnly and SameSite=Strict', () => {
      const { spy, cookie } = responseSpy();

      setAuthCookies(spy, tokens, ttl);

      // httpOnly is what stops an XSS from exfiltrating the token; SameSite
      // strict is what stands in for a CSRF token.
      for (const call of cookie.mock.calls) {
        expect(call[2]).toEqual(expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
      }
    });

    it('gives each cookie the lifetime of the token it carries', () => {
      const { spy, cookie } = responseSpy();

      setAuthCookies(spy, tokens, ttl);

      expect(cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'access.jwt',
        expect.objectContaining({ maxAge: 900_000 }),
      );
      expect(cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'refresh.jwt',
        expect.objectContaining({ maxAge: 604_800_000 }),
      );
    });

    it('sets Secure in production', () => {
      process.env.NODE_ENV = 'production';
      const { spy, cookie } = responseSpy();

      setAuthCookies(spy, tokens, ttl);

      expect(cookie.mock.calls[0][2]).toEqual(expect.objectContaining({ secure: true }));
    });

    it('leaves Secure off outside production, or localhost would drop the cookie', () => {
      process.env.NODE_ENV = 'development';
      const { spy, cookie } = responseSpy();

      setAuthCookies(spy, tokens, ttl);

      expect(cookie.mock.calls[0][2]).toEqual(expect.objectContaining({ secure: false }));
    });
  });

  describe('clearAuthCookies', () => {
    it('clears with the attributes the cookies were written with, minus maxAge', () => {
      const { spy, clearCookie } = responseSpy();

      clearAuthCookies(spy);

      // A mismatch on path/sameSite leaves the cookie in place.
      expect(clearCookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }),
      );
      expect(clearCookie.mock.calls[0][1]).not.toHaveProperty('maxAge');
      expect(clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, expect.anything());
    });
  });

  describe('readAccessToken', () => {
    it('prefers the cookie', () => {
      expect(
        readAccessToken(
          requestWith({ [ACCESS_TOKEN_COOKIE]: 'from-cookie' }, 'Bearer from-header'),
        ),
      ).toBe('from-cookie');
    });

    it('falls back to the Authorization header so Swagger still works', () => {
      expect(readAccessToken(requestWith({}, 'Bearer from-header'))).toBe('from-header');
    });

    it('ignores an empty cookie', () => {
      expect(readAccessToken(requestWith({ [ACCESS_TOKEN_COOKIE]: '' }))).toBeUndefined();
    });

    it('returns undefined when there is no session at all', () => {
      expect(readAccessToken(requestWith({}))).toBeUndefined();
    });
  });

  describe('readRefreshToken', () => {
    it('reads only the cookie — a refresh token is never accepted from a header', () => {
      expect(readRefreshToken(requestWith({ [REFRESH_TOKEN_COOKIE]: 'refresh.jwt' }))).toBe(
        'refresh.jwt',
      );
      expect(readRefreshToken(requestWith({}, 'Bearer refresh.jwt'))).toBeUndefined();
    });
  });
});
