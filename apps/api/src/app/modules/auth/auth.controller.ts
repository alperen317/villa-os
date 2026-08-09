import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
// `import type`: these appear in decorated signatures, which isolatedModules +
// emitDecoratorMetadata require not to look like runtime imports.
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { clearAuthCookies, readAccessToken, readRefreshToken, setAuthCookies } from './auth-cookies';
import { LoginDto } from './dto/login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { InvalidRefreshTokenException } from './exceptions/invalid-refresh-token.exception';
// `import type` is required here: with isolatedModules + emitDecoratorMetadata,
// a type used in a decorated signature must not look like a runtime import.
import type { AccessTokenPayload } from './jwt-payload.interface';
import { AppException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';

/**
 * Endpoints that accept a credential are the ones worth guessing at, so they get
 * a far tighter budget than the global ceiling: 10 attempts per minute per IP
 * makes online password guessing useless without inconveniencing a real login.
 */
const CREDENTIAL_RATE_LIMIT = { limit: 10, ttl: 60_000 };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: CREDENTIAL_RATE_LIMIT })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with username and password (FR-001)' })
  @ApiResponse({ status: 200, description: 'Session cookies are set; the body carries the user' })
  @ApiResponse({ status: 429, description: 'Too many attempts from this address' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenPayload> {
    const user = await this.authService.validateCredentials(dto.username, dto.password);
    const tokens = await this.authService.issueTokens(user);

    setAuthCookies(response, tokens, this.authService.tokenTtl);

    // Returned so the client does not need a second round-trip to /auth/me:
    // the tokens themselves are never in the body any more.
    return { sub: user.id, username: user.username, role: user.role };
  }

  @Public()
  @Throttle({ default: CREDENTIAL_RATE_LIMIT })
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rotate the session using the refresh cookie' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = readRefreshToken(request);
    if (!refreshToken) {
      throw new InvalidRefreshTokenException();
    }

    try {
      const tokens = await this.authService.refresh(refreshToken);
      setAuthCookies(response, tokens, this.authService.tokenTtl);
    } catch (error) {
      // A refresh token that no longer works leaves a cookie the browser would
      // keep replaying; drop it so the client lands on the login screen.
      clearAuthCookies(response);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the session and clear its cookies' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const refreshToken = readRefreshToken(request);

    // Clear unconditionally: logging out must end the session on this browser
    // even when the token was already expired or revoked server-side.
    clearAuthCookies(response);

    if (refreshToken) {
      try {
        await this.authService.logout(refreshToken);
      } catch {
        // Nothing to revoke — the cookies are gone either way.
      }
    }
  }

  @Public()
  @Get('onboarding-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Whether the system has no users yet and needs first-admin onboarding' })
  async onboardingStatus(): Promise<{ needsOnboarding: boolean }> {
    const hasAnyUsers = await this.authService.hasAnyUsers();
    return { needsOnboarding: !hasAnyUsers };
  }

  @Public()
  @Throttle({ default: CREDENTIAL_RATE_LIMIT })
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create the first Administrator account when no users exist yet' })
  async completeOnboarding(
    @Body() dto: OnboardingDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenPayload> {
    const { tokens, user } = await this.authService.completeOnboarding(dto);

    setAuthCookies(response, tokens, this.authService.tokenTtl);

    return { sub: user.id, username: user.username, role: user.role };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return the currently authenticated user (from the session cookie)' })
  me(@CurrentUser() user: AccessTokenPayload): AccessTokenPayload {
    return user;
  }

  @Public()
  @Get('ping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connectivity check: 200 when the session cookie is a valid access token' })
  @ApiResponse({ status: 401, description: 'No session, or the access token is invalid or expired' })
  ping(@Req() request: Request): { authenticated: true; user: AccessTokenPayload } {
    const token = readAccessToken(request);

    if (!token) {
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_NO_SESSION, 'No session');
    }

    try {
      return { authenticated: true, user: this.authService.verifyAccessToken(token) };
    } catch {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_SESSION_EXPIRED,
        'The session is invalid or expired',
      );
    }
  }
}
