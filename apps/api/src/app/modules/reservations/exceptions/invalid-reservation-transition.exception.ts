import { ConflictException } from '@nestjs/common';
import { ReservationStatus } from '../../../../generated/prisma/client';

export class InvalidReservationTransitionException extends ConflictException {
  constructor(from: ReservationStatus, to: ReservationStatus) {
    super(`Cannot move a reservation from ${from} to ${to}`);
  }
}
