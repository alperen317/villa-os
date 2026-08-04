import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Payment, Prisma } from '../../../generated/prisma/client';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PaymentUncheckedCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  findManyByReservation(reservationId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { reservationId },
      orderBy: { paymentDate: 'asc' },
    });
  }
}
