import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/errors/domain.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { MaintenanceStatus } from '../../../../generated/prisma/client';

export class InvalidMaintenanceTransitionException extends DomainException {
  constructor(from: MaintenanceStatus, to: MaintenanceStatus) {
    super(
      HttpStatus.CONFLICT,
      ErrorCode.MAINTENANCE_INVALID_TRANSITION,
      `Cannot move a maintenance record from ${from} to ${to}`,
      { from, to },
    );
  }
}
