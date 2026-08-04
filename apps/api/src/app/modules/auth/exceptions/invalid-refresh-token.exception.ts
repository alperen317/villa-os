import { UnauthorizedException } from '@nestjs/common';

export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super('Refresh token is invalid, expired, or has been revoked');
  }
}
