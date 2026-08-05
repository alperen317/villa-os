import { Test } from '@nestjs/testing';
import { ReportPayment, ReportReservation, ReportVilla, ReportingRepository } from './reporting.repository';
import { ReportingService } from './reporting.service';

function villa(overrides: Partial<ReportVilla> = {}): ReportVilla {
  return { id: 'villa-1', name: 'Bodrum Villa', ...overrides };
}

function reservation(overrides: Partial<ReportReservation> = {}): ReportReservation {
  return {
    id: 'res-1',
    reservationNumber: 'RES-1',
    villaId: 'villa-1',
    villaName: 'Bodrum Villa',
    customerId: 'customer-1',
    customerName: 'Ali Veli',
    checkIn: new Date('2026-08-01T00:00:00.000Z'),
    checkOut: new Date('2026-08-03T00:00:00.000Z'),
    guestCount: 2,
    totalPrice: 4000,
    status: 'Completed' as never,
    ...overrides,
  };
}

function payment(overrides: Partial<ReportPayment> = {}): ReportPayment {
  return {
    id: 'payment-1',
    amount: 3000,
    paymentMethod: 'Cash' as never,
    paymentDate: new Date('2026-08-02T10:00:00.000Z'),
    reservationNumber: 'RES-1',
    villaName: 'Bodrum Villa',
    ...overrides,
  };
}

describe('ReportingService', () => {
  let service: ReportingService;
  let repository: jest.Mocked<ReportingRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportingService,
        {
          provide: ReportingRepository,
          useValue: {
            listActiveVillas: jest.fn(),
            findReservationsOverlapping: jest.fn(),
            findPaymentsInRange: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ReportingService);
    repository = moduleRef.get(ReportingRepository);
  });

  describe('getOccupancyReport (FR-1001)', () => {
    it('computes per-villa occupied nights clamped to the requested range', async () => {
      repository.listActiveVillas.mockResolvedValue([villa()]);
      repository.findReservationsOverlapping.mockResolvedValue([reservation()]);

      const report = await service.getOccupancyReport({ from: '2026-08-01', to: '2026-08-06', villaId: undefined } as never);

      expect(report.totalAvailableNights).toBe(5);
      expect(report.villas).toEqual([
        expect.objectContaining({ villaId: 'villa-1', occupiedNights: 2, availableNights: 5, occupancyRate: 40 }),
      ]);
      expect(report.totalOccupiedNights).toBe(2);
      expect(report.overallOccupancyRate).toBe(40);
    });

    it('clamps a reservation that starts before the range to the range start', async () => {
      repository.listActiveVillas.mockResolvedValue([villa()]);
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({ checkIn: new Date('2026-07-28T00:00:00.000Z'), checkOut: new Date('2026-08-02T00:00:00.000Z') }),
      ]);

      const report = await service.getOccupancyReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.villas[0].occupiedNights).toBe(1);
    });

    it('does not double count overlapping bookings on the same villa (e.g. two floors booked the same day)', async () => {
      repository.listActiveVillas.mockResolvedValue([villa()]);
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({ id: 'res-a', checkIn: new Date('2026-08-01T00:00:00.000Z'), checkOut: new Date('2026-08-03T00:00:00.000Z') }),
        reservation({ id: 'res-b', checkIn: new Date('2026-08-02T00:00:00.000Z'), checkOut: new Date('2026-08-04T00:00:00.000Z') }),
      ]);

      const report = await service.getOccupancyReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.villas[0].occupiedNights).toBe(3);
    });

    it('returns zero rates when there are no active villas', async () => {
      repository.listActiveVillas.mockResolvedValue([]);
      repository.findReservationsOverlapping.mockResolvedValue([]);

      const report = await service.getOccupancyReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.overallOccupancyRate).toBe(0);
      expect(report.daily.every((point) => point.occupancyRate === 0)).toBe(true);
    });
  });

  describe('getRevenueReport (FR-1002)', () => {
    it('sums payments by day and by method', async () => {
      repository.findPaymentsInRange.mockResolvedValue([
        payment({ id: 'p1', amount: 3000, paymentMethod: 'Cash' as never, paymentDate: new Date('2026-08-02T10:00:00.000Z') }),
        payment({ id: 'p2', amount: 6000, paymentMethod: 'CreditCard' as never, paymentDate: new Date('2026-08-02T18:00:00.000Z') }),
      ]);

      const report = await service.getRevenueReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.totalRevenue).toBe(9000);
      expect(report.paymentCount).toBe(2);
      expect(report.byMethod).toEqual(
        expect.arrayContaining([
          { method: 'Cash', amount: 3000 },
          { method: 'CreditCard', amount: 6000 },
        ]),
      );
      expect(report.daily.find((point) => point.date === '2026-08-02')?.amount).toBe(9000);
    });

    it('reports zero revenue for an empty range', async () => {
      repository.findPaymentsInRange.mockResolvedValue([]);

      const report = await service.getRevenueReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.totalRevenue).toBe(0);
      expect(report.paymentCount).toBe(0);
      expect(report.byMethod).toEqual([]);
    });
  });

  describe('getReservationsReport (FR-1003)', () => {
    it('aggregates nights, guest-nights, and status counts', async () => {
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({ id: 'res-1', guestCount: 2, status: 'Completed' as never }),
        reservation({ id: 'res-2', guestCount: 1, status: 'Confirmed' as never }),
      ]);

      const report = await service.getReservationsReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.totalReservations).toBe(2);
      expect(report.totalGuestNights).toBe(2 * 2 + 1 * 2);
      expect(report.averageLengthOfStay).toBe(2);
      expect(report.byStatus).toEqual(
        expect.arrayContaining([
          { status: 'Completed', count: 1 },
          { status: 'Confirmed', count: 1 },
        ]),
      );
    });

    it('reports zero average length of stay for an empty range', async () => {
      repository.findReservationsOverlapping.mockResolvedValue([]);

      const report = await service.getReservationsReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.totalReservations).toBe(0);
      expect(report.averageLengthOfStay).toBe(0);
    });
  });

  describe('getCustomersReport (FR-1004)', () => {
    it('groups reservations by customer and sorts by total spend descending', async () => {
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({ id: 'res-1', customerId: 'customer-1', customerName: 'Ali Veli', totalPrice: 4000 }),
        reservation({ id: 'res-2', customerId: 'customer-2', customerName: 'Ayşe Kaya', totalPrice: 9000 }),
        reservation({ id: 'res-3', customerId: 'customer-1', customerName: 'Ali Veli', totalPrice: 1000 }),
      ]);

      const report = await service.getCustomersReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.totalCustomers).toBe(2);
      expect(report.customers[0]).toEqual(
        expect.objectContaining({ customerId: 'customer-2', totalSpent: 9000, reservationCount: 1 }),
      );
      expect(report.customers[1]).toEqual(
        expect.objectContaining({ customerId: 'customer-1', totalSpent: 5000, reservationCount: 2 }),
      );
    });

    it('keeps the latest check-in date across multiple reservations for the same customer', async () => {
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({ id: 'res-1', customerId: 'customer-1', checkIn: new Date('2026-08-01T00:00:00.000Z') }),
        reservation({ id: 'res-2', customerId: 'customer-1', checkIn: new Date('2026-08-04T00:00:00.000Z') }),
      ]);

      const report = await service.getCustomersReport({ from: '2026-08-01', to: '2026-08-06' } as never);

      expect(report.customers[0].lastCheckIn).toBe('2026-08-04');
    });
  });
});
