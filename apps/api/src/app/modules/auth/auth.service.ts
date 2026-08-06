import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import { InvalidRefreshTokenException } from './exceptions/invalid-refresh-token.exception';
import { AccessTokenPayload, RefreshTokenPayload } from './jwt-payload.interface';
import { User, UserRole } from '../../../generated/prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TOKEN_REDIS_PREFIX = 'refresh-token:';

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshTtlSeconds = Number(
      this.configService.getOrThrow<string>('JWT_REFRESH_TTL_SECONDS'),
    );
  }

  async validateCredentials(username: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new InvalidCredentialsException();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsException();
    }

    if (!user.isActive) {
      throw new InvalidCredentialsException();
    }

    return user;
  }

  async hasAnyUsers(): Promise<boolean> {
    return (await this.prisma.user.count()) > 0;
  }

  async completeOnboarding(dto: OnboardingDto): Promise<TokenPair> {
    const existingUserCount = await this.prisma.user.count();
    if (existingUserCount > 0) {
      throw new ConflictException('Kurulum zaten tamamlanmış');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        role: UserRole.Administrator,
        isActive: true,
      },
    });

    return this.issueTokens(user);
  }

  async issueTokens(user: User): Promise<TokenPair> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.signAndStoreRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(refreshToken);

    const storedUserId = await this.redis.get(REFRESH_TOKEN_REDIS_PREFIX + payload.jti);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new InvalidRefreshTokenException();
    }

    // Rotate: the presented refresh token is single-use.
    await this.redis.del(REFRESH_TOKEN_REDIS_PREFIX + payload.jti);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new InvalidRefreshTokenException();
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken);
    await this.redis.del(REFRESH_TOKEN_REDIS_PREFIX + payload.jti);
  }

  verifyAccessToken(accessToken: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(accessToken, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  private signAccessToken(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Number(this.configService.getOrThrow<string>('JWT_ACCESS_TTL_SECONDS')),
    });
  }

  private async signAndStoreRefreshToken(userId: string): Promise<string> {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: userId, jti };

    const token = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtlSeconds,
    });

    await this.redis.set(
      REFRESH_TOKEN_REDIS_PREFIX + jti,
      userId,
      'EX',
      this.refreshTtlSeconds,
    );

    return token;
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new InvalidRefreshTokenException();
    }
  }
}
