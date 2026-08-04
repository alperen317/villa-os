import { Test } from '@nestjs/testing';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: DashboardRepository, useValue: {} }],
    }).compile();

    service = moduleRef.get(DashboardService);
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
