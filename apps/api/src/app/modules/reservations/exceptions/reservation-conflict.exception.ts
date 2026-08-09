import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/errors/domain.exception';
import { ErrorCode } from '../../../common/errors/error-codes';

export class ReservationConflictException extends DomainException {
  constructor(conflictingReservationId: string) {
    super(
      HttpStatus.CONFLICT,
      ErrorCode.RESERVATION_CONFLICT,
      'These dates conflict with an existing reservation for this villa/floor',
      { conflictingReservationId },
    );
  }
}
