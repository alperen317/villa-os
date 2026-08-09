import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/errors/domain.exception';
import { ErrorCode } from '../../../common/errors/error-codes';

export class InvalidRefreshTokenException extends DomainException {
  constructor() {
    super(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
      'Refresh token is invalid, expired, or has been revoked',
    );
  }
}
