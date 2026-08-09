import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/errors/domain.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ReservationStatus } from '../../../../generated/prisma/client';

export class InvalidReservationTransitionException extends DomainException {
  constructor(from: ReservationStatus, to: ReservationStatus) {
    super(
      HttpStatus.CONFLICT,
      ErrorCode.RESERVATION_INVALID_TRANSITION,
      `Cannot move a reservation from ${from} to ${to}`,
      { from, to },
    );
  }
}
