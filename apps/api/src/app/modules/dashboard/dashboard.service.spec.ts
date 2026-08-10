import { Test } from '@nestjs/testing';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: {
    countArrivalsToday: jest.Mock;
    countDeparturesToday: jest.Mock;
    sumCurrentGuests: jest.Mock;
    countOccupiedVillas: jest.Mock;
    countActiveVillas: jest.Mock;
    sumRevenueThisMonth: jest.Mock;
    sumExpensesThisMonth: jest.Mock;
    countOpenHousekeepingTasks: jest.Mock;
    countOpenMaintenanceRecords: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      countArrivalsToday: jest.fn().mockResolvedValue(0),
      countDeparturesToday: jest.fn().mockResolvedValue(0),
      sumCurrentGuests: jest.fn().mockResolvedValue(0),
      countOccupiedVillas: jest.fn().mockResolvedValue(0),
      countActiveVillas: jest.fn().mockResolvedValue(0),
      sumRevenueThisMonth: jest.fn().mockResolvedValue(0),
      sumExpensesThisMonth: jest.fn().mockResolvedValue(0),
      countOpenHousekeepingTasks: jest.fn().mockResolvedValue(0),
      countOpenMaintenanceRecords: jest.fn().mockResolvedValue(0),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: DashboardRepository, useValue: repository }],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  describe('getSummary', () => {
    it('nets the month off, so the headline is what was kept', async () => {
      repository.sumRevenueThisMonth.mockResolvedValue(48000);
      repository.sumExpensesThisMonth.mockResolvedValue(13500);

      const summary = await service.getSummary();

      expect(summary.revenueThisMonth).toBe(48000);
      expect(summary.expensesThisMonth).toBe(13500);
      expect(summary.netThisMonth).toBe(34500);
    });

    it('shows a month that cost more than it earned as negative', async () => {
      repository.sumRevenueThisMonth.mockResolvedValue(2000);
      repository.sumExpensesThisMonth.mockResolvedValue(9000);

      const summary = await service.getSummary();

      expect(summary.netThisMonth).toBe(-7000);
    });

    it('reads revenue and expenses over the same month bounds', async () => {
      // Two different windows would produce a net that belongs to neither of them.
      await service.getSummary();

      expect(repository.sumExpensesThisMonth.mock.calls[0]).toEqual(
        repository.sumRevenueThisMonth.mock.calls[0],
      );
    });

    it('keeps the net exact where subtracting floats would not', async () => {
      repository.sumRevenueThisMonth.mockResolvedValue(0.3);
      repository.sumExpensesThisMonth.mockResolvedValue(0.1);

      const summary = await service.getSummary();

      expect(summary.netThisMonth).toBe(0.2);
    });
  });

  describe('calculateOccupancyRate', () => {
    it('returns 0 when there are no active villas, without dividing by zero', () => {
      expect(service.calculateOccupancyRate(0, 0)).toBe(0);
    });

    it('rounds to the nearest whole percentage', () => {
      expect(service.calculateOccupancyRate(1, 3)).toBe(33);
    });

    it('returns 100 when every active villa is occupied', () => {
      expect(service.calculateOccupancyRate(4, 4)).toBe(100);
    });
  });
});
