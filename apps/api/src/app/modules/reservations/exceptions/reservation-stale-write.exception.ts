import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/errors/domain.exception';
import { ErrorCode } from '../../../common/errors/error-codes';

export class ReservationStaleWriteException extends DomainException {
  constructor(currentUpdatedAt: Date) {
    super(
      HttpStatus.CONFLICT,
      ErrorCode.RESERVATION_STALE_WRITE,
      'This reservation was modified by someone else since you loaded it',
      { currentUpdatedAt: currentUpdatedAt.toISOString() },
    );
  }
}
