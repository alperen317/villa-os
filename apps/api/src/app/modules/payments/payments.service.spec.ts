import { Test } from '@nestjs/testing';
import { ReservationsService } from '../reservations/reservations.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { Payment, PaymentMethod } from '../../../generated/prisma/client';

function payment(amount: number): Payment {
  return {
    id: 'payment-id',
    reservationId: 'reservation-id',
    amount: amount as unknown as Payment['amount'],
    paymentMethod: PaymentMethod.Cash,
    paymentDate: new Date(),
    referenceNumber: null,
    notes: null,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PaymentsRepository, useValue: {} },
        { provide: ReservationsService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  describe('buildSummary', () => {
    it('treats an unpaid reservation as fully outstanding', () => {
      const summary = service.buildSummary('res-1', 1000, []);

      expect(summary.totalPaid).toBe(0);
      expect(summary.outstandingBalance).toBe(1000);
    });

    it('subtracts partial payments from the total price', () => {
      const summary = service.buildSummary('res-1', 1000, [payment(300), payment(200)]);

      expect(summary.totalPaid).toBe(500);
      expect(summary.outstandingBalance).toBe(500);
    });

    it('reaches a zero balance once payments equal the total price', () => {
      const summary = service.buildSummary('res-1', 1000, [payment(600), payment(400)]);

      expect(summary.outstandingBalance).toBe(0);
    });

    it('allows a negative balance when payments exceed the total price (overpayment)', () => {
      const summary = service.buildSummary('res-1', 1000, [payment(1200)]);

      expect(summary.totalPaid).toBe(1200);
      expect(summary.outstandingBalance).toBe(-200);
    });

    it('keeps fractional instalments exact', () => {
      // Summing these as floats yields 1000.0000000000001, leaving a fully paid
      // reservation with a phantom -1.1368683772161603e-13 balance.
      const summary = service.buildSummary('res-1', 1000, [
        payment(128.3),
        payment(435.85),
        payment(435.85),
      ]);

      expect(summary.totalPaid).toBe(1000);
      expect(summary.outstandingBalance).toBe(0);
    });
  });
});
