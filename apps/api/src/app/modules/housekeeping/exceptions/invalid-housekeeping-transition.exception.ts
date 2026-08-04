import { ConflictException } from '@nestjs/common';
import { HousekeepingStatus } from '../../../../generated/prisma/client';

export class InvalidHousekeepingTransitionException extends ConflictException {
  constructor(from: HousekeepingStatus, to: HousekeepingStatus) {
    super(`Cannot move a housekeeping task from ${from} to ${to}`);
  }
}
