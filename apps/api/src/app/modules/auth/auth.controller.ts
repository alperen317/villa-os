import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AccessTokenPayload } from './jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with username and password (FR-001)' })
  @ApiResponse({ status: 200, description: 'Access and refresh token pair' })
  async login(@Body() dto: LoginDto): Promise<TokenPair> {
    const user = await this.authService.validateCredentials(dto.username, dto.password);
    return this.authService.issueTokens(user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
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
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create the first Administrator account when no users exist yet' })
  completeOnboarding(@Body() dto: OnboardingDto): Promise<TokenPair> {
    return this.authService.completeOnboarding(dto);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return the currently authenticated user (from the access token)' })
  me(@CurrentUser() user: AccessTokenPayload): AccessTokenPayload {
    return user;
  }

  @Public()
  @Get('ping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manual connectivity check: 200 if the bearer token is a valid access token, 400 otherwise',
  })
  ping(@Headers('authorization') authorization?: string): { authenticated: true; user: AccessTokenPayload } {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;

    if (!token) {
      throw new BadRequestException('No access token provided');
    }

    try {
      const user = this.authService.verifyAccessToken(token);
      return { authenticated: true, user };
    } catch {
      throw new BadRequestException('Access token is invalid or expired');
    }
  }
}
