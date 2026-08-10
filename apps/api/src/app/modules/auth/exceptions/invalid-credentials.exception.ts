import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/errors/domain.exception';
import { ErrorCode } from '../../../common/errors/error-codes';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    // Deliberately does not say which half was wrong — that would tell an
    // attacker which usernames exist.
    super(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      'Invalid username or password',
    );
  }
}
