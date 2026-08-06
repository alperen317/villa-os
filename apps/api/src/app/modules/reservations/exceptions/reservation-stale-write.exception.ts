import { ConflictException } from '@nestjs/common';

export class ReservationStaleWriteException extends ConflictException {
  constructor(currentUpdatedAt: Date) {
    super({
      message: 'This reservation was modified by someone else since you loaded it',
      currentUpdatedAt: currentUpdatedAt.toISOString(),
    });
  }
}
