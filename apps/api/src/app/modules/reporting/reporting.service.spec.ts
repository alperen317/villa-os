import { Test } from '@nestjs/testing';
import {
  ReportExpense,
  ReportPayment,
  ReportReservation,
  ReportVilla,
  ReportingRepository,
} from './reporting.repository';
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

function expense(overrides: Partial<ReportExpense> = {}): ReportExpense {
  return {
    id: 'expense-1',
    amount: 1200,
    category: 'Utilities' as never,
    expenseDate: new Date('2026-08-02T00:00:00.000Z'),
    description: 'Elektrik faturası',
    supplier: null,
    villaId: 'villa-1',
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
            findExpensesInRange: jest.fn().mockResolvedValue([]),
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

      const report = await service.getOccupancyReport({
        from: '2026-08-01',
        to: '2026-08-06',
        villaId: undefined,
      } as never);

      expect(report.totalAvailableNights).toBe(5);
      expect(report.villas).toEqual([
        expect.objectContaining({
          villaId: 'villa-1',
          occupiedNights: 2,
          availableNights: 5,
          occupancyRate: 40,
        }),
      ]);
      expect(report.totalOccupiedNights).toBe(2);
      expect(report.overallOccupancyRate).toBe(40);
    });

    it('clamps a reservation that starts before the range to the range start', async () => {
      repository.listActiveVillas.mockResolvedValue([villa()]);
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({
          checkIn: new Date('2026-07-28T00:00:00.000Z'),
          checkOut: new Date('2026-08-02T00:00:00.000Z'),
        }),
      ]);

      const report = await service.getOccupancyReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.villas[0].occupiedNights).toBe(1);
    });

    it('does not double count overlapping bookings on the same villa (e.g. two floors booked the same day)', async () => {
      repository.listActiveVillas.mockResolvedValue([villa()]);
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({
          id: 'res-a',
          checkIn: new Date('2026-08-01T00:00:00.000Z'),
          checkOut: new Date('2026-08-03T00:00:00.000Z'),
        }),
        reservation({
          id: 'res-b',
          checkIn: new Date('2026-08-02T00:00:00.000Z'),
          checkOut: new Date('2026-08-04T00:00:00.000Z'),
        }),
      ]);

      const report = await service.getOccupancyReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.villas[0].occupiedNights).toBe(3);
    });

    it('returns zero rates when there are no active villas', async () => {
      repository.listActiveVillas.mockResolvedValue([]);
      repository.findReservationsOverlapping.mockResolvedValue([]);

      const report = await service.getOccupancyReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.overallOccupancyRate).toBe(0);
      expect(report.daily.every((point) => point.occupancyRate === 0)).toBe(true);
    });
  });

  describe('getRevenueReport (FR-1002)', () => {
    it('sums payments by day and by method', async () => {
      repository.findPaymentsInRange.mockResolvedValue([
        payment({
          id: 'p1',
          amount: 3000,
          paymentMethod: 'Cash' as never,
          paymentDate: new Date('2026-08-02T10:00:00.000Z'),
        }),
        payment({
          id: 'p2',
          amount: 6000,
          paymentMethod: 'CreditCard' as never,
          paymentDate: new Date('2026-08-02T18:00:00.000Z'),
        }),
      ]);

      const report = await service.getRevenueReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

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

      const report = await service.getRevenueReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.totalRevenue).toBe(0);
      expect(report.paymentCount).toBe(0);
      expect(report.byMethod).toEqual([]);
    });

    it('nets the same window off against expenses', async () => {
      repository.findPaymentsInRange.mockResolvedValue([payment({ amount: 9000 })]);
      repository.findExpensesInRange.mockResolvedValue([
        expense({ amount: 1200 }),
        expense({ id: 'e2', amount: 800 }),
      ]);

      const report = await service.getRevenueReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.totalExpenses).toBe(2000);
      expect(report.netProfit).toBe(7000);
    });

    it('reports a loss rather than clamping it at zero', async () => {
      // A quiet month with a new boiler in it is a real outcome, and rounding it up to
      // break-even would hide exactly the month worth looking at.
      repository.findPaymentsInRange.mockResolvedValue([payment({ amount: 1000 })]);
      repository.findExpensesInRange.mockResolvedValue([expense({ amount: 4500 })]);

      const report = await service.getRevenueReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.netProfit).toBe(-3500);
    });

    it('keeps the net exact where floating point would drift', async () => {
      repository.findPaymentsInRange.mockResolvedValue([
        payment({ id: 'p1', amount: 0.1 }),
        payment({ id: 'p2', amount: 0.2 }),
      ]);
      repository.findExpensesInRange.mockResolvedValue([expense({ amount: 0.3 })]);

      const report = await service.getRevenueReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.netProfit).toBe(0);
    });
  });

  describe('getExpensesReport (FR-1005)', () => {
    it('groups by category and sorts the heaviest first', async () => {
      repository.findExpensesInRange.mockResolvedValue([
        expense({ id: 'e1', category: 'Utilities' as never, amount: 1200 }),
        expense({ id: 'e2', category: 'Staff' as never, amount: 5000 }),
        expense({ id: 'e3', category: 'Utilities' as never, amount: 800 }),
      ]);

      const report = await service.getExpensesReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.totalExpenses).toBe(7000);
      expect(report.expenseCount).toBe(3);
      expect(report.byCategory).toEqual([
        { category: 'Staff', amount: 5000, count: 1 },
        { category: 'Utilities', amount: 2000, count: 2 },
      ]);
    });

    it('separates the costs no villa carries, so per-villa totals are readable', async () => {
      // These are excluded the moment the report is filtered to one villa; naming the
      // figure is what stops the two views looking like an arithmetic error.
      repository.findExpensesInRange.mockResolvedValue([
        expense({ id: 'e1', villaId: 'villa-1', villaName: 'Bodrum Villa', amount: 1200 }),
        expense({ id: 'e2', villaId: null, villaName: null, amount: 3000 }),
      ]);

      const report = await service.getExpensesReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.unallocatedExpenses).toBe(3000);
      expect(report.byVilla).toEqual([
        { villaId: null, villaName: null, amount: 3000 },
        { villaId: 'villa-1', villaName: 'Bodrum Villa', amount: 1200 },
      ]);
    });

    it('files each cost under the day it is dated, and leaves the other days at zero', async () => {
      repository.findExpensesInRange.mockResolvedValue([
        expense({ id: 'e1', expenseDate: new Date('2026-08-02T00:00:00.000Z'), amount: 1200 }),
        expense({ id: 'e2', expenseDate: new Date('2026-08-02T00:00:00.000Z'), amount: 800 }),
      ]);

      const report = await service.getExpensesReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.daily).toHaveLength(5);
      expect(report.daily.find((point) => point.date === '2026-08-02')?.amount).toBe(2000);
      expect(report.daily.find((point) => point.date === '2026-08-03')?.amount).toBe(0);
    });

    it('returns an empty report rather than throwing when nothing was spent', async () => {
      repository.findExpensesInRange.mockResolvedValue([]);

      const report = await service.getExpensesReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.totalExpenses).toBe(0);
      expect(report.unallocatedExpenses).toBe(0);
      expect(report.byCategory).toEqual([]);
      expect(report.byVilla).toEqual([]);
    });
  });

  describe('getReservationsReport (FR-1003)', () => {
    it('aggregates nights, guest-nights, and status counts', async () => {
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({ id: 'res-1', guestCount: 2, status: 'Completed' as never }),
        reservation({ id: 'res-2', guestCount: 1, status: 'Confirmed' as never }),
      ]);

      const report = await service.getReservationsReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

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

      const report = await service.getReservationsReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.totalReservations).toBe(0);
      expect(report.averageLengthOfStay).toBe(0);
    });
  });

  describe('getCustomersReport (FR-1004)', () => {
    it('groups reservations by customer and sorts by total spend descending', async () => {
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({
          id: 'res-1',
          customerId: 'customer-1',
          customerName: 'Ali Veli',
          totalPrice: 4000,
        }),
        reservation({
          id: 'res-2',
          customerId: 'customer-2',
          customerName: 'Ayşe Kaya',
          totalPrice: 9000,
        }),
        reservation({
          id: 'res-3',
          customerId: 'customer-1',
          customerName: 'Ali Veli',
          totalPrice: 1000,
        }),
      ]);

      const report = await service.getCustomersReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.totalCustomers).toBe(2);
      expect(report.customers[0]).toEqual(
        expect.objectContaining({
          customerId: 'customer-2',
          totalSpent: 9000,
          reservationCount: 1,
        }),
      );
      expect(report.customers[1]).toEqual(
        expect.objectContaining({
          customerId: 'customer-1',
          totalSpent: 5000,
          reservationCount: 2,
        }),
      );
    });

    it('keeps the latest check-in date across multiple reservations for the same customer', async () => {
      repository.findReservationsOverlapping.mockResolvedValue([
        reservation({
          id: 'res-1',
          customerId: 'customer-1',
          checkIn: new Date('2026-08-01T00:00:00.000Z'),
        }),
        reservation({
          id: 'res-2',
          customerId: 'customer-1',
          checkIn: new Date('2026-08-04T00:00:00.000Z'),
        }),
      ]);

      const report = await service.getCustomersReport({
        from: '2026-08-01',
        to: '2026-08-06',
      } as never);

      expect(report.customers[0].lastCheckIn).toBe('2026-08-04');
    });
  });
});
