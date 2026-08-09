import { Injectable } from '@nestjs/common';
import { MoneyInput, subtractMoney, sumMoney } from '../../common/money';
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

    return this.buildSummary(reservationId, reservation.totalPrice, payments);
  }

  /** FR-602: outstanding balance = total price minus all recorded payments (can go negative — overpayment, see docs/FEATURES/payments.md). */
  buildSummary(reservationId: string, totalPrice: MoneyInput, payments: Payment[]): PaymentsSummary {
    const totalPaid = sumMoney(payments.map((payment) => payment.amount));

    return {
      reservationId,
      totalPrice: Number(totalPrice),
      totalPaid,
      outstandingBalance: subtractMoney(totalPrice, totalPaid),
      payments,
    };
  }
}
