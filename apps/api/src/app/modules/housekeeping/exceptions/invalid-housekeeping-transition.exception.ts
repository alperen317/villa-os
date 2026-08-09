import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/errors/domain.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { HousekeepingStatus } from '../../../../generated/prisma/client';

export class InvalidHousekeepingTransitionException extends DomainException {
  constructor(from: HousekeepingStatus, to: HousekeepingStatus) {
    super(
      HttpStatus.CONFLICT,
      ErrorCode.HOUSEKEEPING_INVALID_TRANSITION,
      `Cannot move a housekeeping task from ${from} to ${to}`,
      { from, to },
    );
  }
}
