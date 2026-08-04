import { ConflictException } from '@nestjs/common';

export class ReservationConflictException extends ConflictException {
  constructor(conflictingReservationId: string) {
    super({
      message: 'These dates conflict with an existing reservation for this villa/floor',
      conflictingReservationId,
    });
  }
}
