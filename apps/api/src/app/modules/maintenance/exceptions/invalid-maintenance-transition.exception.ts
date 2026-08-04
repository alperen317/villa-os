import { ConflictException } from '@nestjs/common';
import { MaintenanceStatus } from '../../../../generated/prisma/client';

export class InvalidMaintenanceTransitionException extends ConflictException {
  constructor(from: MaintenanceStatus, to: MaintenanceStatus) {
    super(`Cannot move a maintenance record from ${from} to ${to}`);
  }
}
