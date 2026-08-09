import { expectRejectionCode } from '../../common/errors/expect-error-code';
import { ErrorCode } from '../../common/errors/error-codes';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { AuthService } from './auth.service';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import { User, UserRole } from '../../../generated/prisma/client';

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_TTL_SECONDS: '900',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_TTL_SECONDS: '604800',
};

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'admin',
    passwordHash: 'hashed-password',
    role: 'Administrator' as UserRole,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; count: jest.Mock; create: jest.Mock };
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let configService: ConfigService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), count: jest.fn(), create: jest.fn() },
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    // Runs the callback against the same mock: the lock itself is a database
    // guarantee, so these tests only cover the logic it guards.
    prisma.$transaction.mockImplementation((work: (tx: unknown) => unknown) => work(prisma));
    jwtService = { sign: jest.fn(), verify: jest.fn() };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    configService = { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      redis as unknown as RedisService,
      configService,
    );
  });

  describe('validateCredentials', () => {
    it('throws InvalidCredentialsException when the username does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.validateCredentials('ghost', 'whatever')).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('throws InvalidCredentialsException when the password does not match', async () => {
      const user = buildUser({ passwordHash: await bcrypt.hash('correct-password', 10) });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.validateCredentials('admin', 'wrong-password')).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('returns the user when the credentials are valid', async () => {
      const user = buildUser({ passwordHash: await bcrypt.hash('correct-password', 10) });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.validateCredentials('admin', 'correct-password')).resolves.toEqual(
        user,
      );
    });

    it('throws InvalidCredentialsException when the user is deactivated', async () => {
      const user = buildUser({
        passwordHash: await bcrypt.hash('correct-password', 10),
        isActive: false,
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.validateCredentials('admin', 'correct-password')).rejects.toThrow(
        InvalidCredentialsException,
      );
    });
  });

  describe('hasAnyUsers', () => {
    it('returns false when the users table is empty', async () => {
      prisma.user.count.mockResolvedValue(0);

      await expect(service.hasAnyUsers()).resolves.toBe(false);
    });

    it('returns true when at least one user exists', async () => {
      prisma.user.count.mockResolvedValue(1);

      await expect(service.hasAnyUsers()).resolves.toBe(true);
    });
  });

  describe('completeOnboarding', () => {
    it('creates an Administrator and issues tokens when no users exist yet', async () => {
      prisma.user.count.mockResolvedValue(0);
      const createdUser = buildUser({ username: 'first-admin' });
      prisma.user.create.mockResolvedValue(createdUser);
      jwtService.sign.mockReturnValueOnce('access.jwt').mockReturnValueOnce('refresh.jwt');

      const { tokens, user } = await service.completeOnboarding({
        username: 'first-admin',
        password: 'a-strong-password',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ username: 'first-admin', role: 'Administrator', isActive: true }),
        }),
      );
      expect(tokens).toEqual({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt' });
      // The controller needs the user to set cookies and answer with it.
      expect(user).toBe(createdUser);
    });

    it('rejects when a user already exists', async () => {
      prisma.user.count.mockResolvedValue(1);

      await expectRejectionCode(
        service.completeOnboarding({ username: 'someone', password: 'a-strong-password' }),
        ErrorCode.ONBOARDING_ALREADY_COMPLETED,
        409,
      );
    });

    it('counts and inserts inside one locked transaction', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create.mockResolvedValue(buildUser());
      jwtService.sign.mockReturnValue('jwt');

      await service.completeOnboarding({ username: 'first-admin', password: 'a-strong-password' });

      // Otherwise two simultaneous requests both see an empty table and the
      // system ends up with two "first" Administrators.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('issueTokens', () => {
    it('signs an access token and a refresh token, and stores the refresh token in Redis', async () => {
      jwtService.sign.mockReturnValueOnce('access.jwt').mockReturnValueOnce('refresh.jwt');
      const user = buildUser();

      const tokens = await service.issueTokens(user);

      expect(tokens).toEqual({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt' });

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: user.id, username: user.username, role: user.role },
        { secret: CONFIG.JWT_ACCESS_SECRET, expiresIn: 900 },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: user.id, jti: expect.any(String) },
        { secret: CONFIG.JWT_REFRESH_SECRET, expiresIn: 604800 },
      );

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh-token:/),
        user.id,
        'EX',
        604800,
      );
    });
  });

  describe('refresh', () => {
    it('throws InvalidRefreshTokenException when the token signature/expiry is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expectRejectionCode(service.refresh('bad.token'), ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('throws InvalidRefreshTokenException when the token has already been used/revoked', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1' });
      redis.get.mockResolvedValue(null);

      await expectRejectionCode(service.refresh('token'), ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    });

    it('throws InvalidRefreshTokenException when the stored owner does not match the token subject', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1' });
      redis.get.mockResolvedValue('someone-else');

      await expectRejectionCode(service.refresh('token'), ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    });

    it('throws InvalidRefreshTokenException when the user no longer exists', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1' });
      redis.get.mockResolvedValue('user-1');
      prisma.user.findUnique.mockResolvedValue(null);

      await expectRejectionCode(service.refresh('token'), ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    });

    it('rotates the refresh token: deletes the old jti and issues a brand-new pair', async () => {
      const user = buildUser();
      jwtService.verify.mockReturnValue({ sub: user.id, jti: 'jti-1' });
      redis.get.mockResolvedValue(user.id);
      prisma.user.findUnique.mockResolvedValue(user);
      jwtService.sign.mockReturnValueOnce('new-access.jwt').mockReturnValueOnce('new-refresh.jwt');

      const tokens = await service.refresh('old.token');

      expect(redis.del).toHaveBeenCalledWith('refresh-token:jti-1');
      expect(tokens).toEqual({ accessToken: 'new-access.jwt', refreshToken: 'new-refresh.jwt' });
    });

    it('rejects the same refresh token a second time (single-use)', async () => {
      const user = buildUser();
      jwtService.verify.mockReturnValue({ sub: user.id, jti: 'jti-1' });
      prisma.user.findUnique.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('token');

      redis.get.mockResolvedValueOnce(user.id);
      await service.refresh('old.token');

      redis.get.mockResolvedValueOnce(null); // simulates the key having been deleted on first use
      await expectRejectionCode(service.refresh('old.token'), ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    });
  });

  describe('logout', () => {
    it('deletes the refresh token entry derived from the presented token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1' });

      await service.logout('token');

      expect(redis.del).toHaveBeenCalledWith('refresh-token:jti-1');
    });

    it('throws InvalidRefreshTokenException for a malformed token instead of deleting anything', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('malformed');
      });

      await expectRejectionCode(service.logout('garbage'), ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the decoded payload for a valid access token', () => {
      const payload = { sub: 'user-1', username: 'admin', role: 'Administrator' as UserRole };
      jwtService.verify.mockReturnValue(payload);

      expect(service.verifyAccessToken('token')).toEqual(payload);
      expect(jwtService.verify).toHaveBeenCalledWith('token', {
        secret: CONFIG.JWT_ACCESS_SECRET,
      });
    });

    it('propagates the error for an invalid/expired access token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      expect(() => service.verifyAccessToken('token')).toThrow('jwt expired');
    });
  });
});
