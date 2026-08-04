import { Injectable } from '@nestjs/common';
import { ReservationsService } from '../reservations/reservations.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsRepository } from './payments.repository';
import { Payment } from '../../../generated/prisma/client';

export interface PaymentsSummary {
  reservationId: string;
  totalPrice: number;
  totalPaid: number;
  outstandingBalance: number;
  payments: Payment[];
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly reservationsService: ReservationsService,
  ) {}

  async create(reservationId: string, dto: CreatePaymentDto): Promise<Payment> {
    await this.reservationsService.findOneOrThrow(reservationId);

    return this.paymentsRepository.create({
      reservationId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
      referenceNumber: dto.referenceNumber,
      notes: dto.notes,
    });
  }

  async findSummaryByReservation(reservationId: string): Promise<PaymentsSummary> {
    const reservation = await this.reservationsService.findOneOrThrow(reservationId);
    const payments = await this.paymentsRepository.findManyByReservation(reservationId);

    return this.buildSummary(reservationId, Number(reservation.totalPrice), payments);
  }

  /** FR-602: outstanding balance = total price minus all recorded payments (can go negative — overpayment, see docs/FEATURES/payments.md). */
  buildSummary(reservationId: string, totalPrice: number, payments: Payment[]): PaymentsSummary {
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      reservationId,
      totalPrice,
      totalPaid,
      outstandingBalance: totalPrice - totalPaid,
      payments,
    };
  }
}
