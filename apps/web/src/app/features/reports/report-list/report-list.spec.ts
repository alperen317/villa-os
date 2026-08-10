import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SettingsStore } from '../../settings/settings.store';
import { VillasStore } from '../../villas/villas.store';
import { ReportsService } from '../reports.service';
import { ReportList } from './report-list';

describe('ReportList', () => {
  let component: ReportList;
  let reportsService: {
    getOccupancy: jest.Mock;
    getRevenue: jest.Mock;
    getReservations: jest.Mock;
    getCustomers: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 20));

    reportsService = {
      getOccupancy: jest.fn().mockResolvedValue({ daily: [] }),
      getRevenue: jest.fn().mockResolvedValue({ daily: [], byMethod: [] }),
      getReservations: jest.fn().mockResolvedValue({ byStatus: [], reservations: [] }),
      getCustomers: jest.fn().mockResolvedValue({ topCustomers: [] }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: VillasStore, useValue: { villas: signal([]), ensureLoaded: jest.fn() } },
        { provide: SettingsStore, useValue: { settings: signal(null) } },
        { provide: NzMessageService, useValue: { error: jest.fn(), success: jest.fn() } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new ReportList());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('tab loading', () => {
    it('fetches only the report the open tab needs', async () => {
      await component.loadActiveReport();

      expect(reportsService.getOccupancy).toHaveBeenCalledTimes(1);
      expect(reportsService.getRevenue).not.toHaveBeenCalled();
      expect(reportsService.getCustomers).not.toHaveBeenCalled();
    });

    it('does not refetch a tab it has already loaded', async () => {
      await component.loadActiveReport();
      component.onTabIndexChange(1);
      await Promise.resolve();
      component.onTabIndexChange(0);
      await Promise.resolve();

      expect(reportsService.getOccupancy).toHaveBeenCalledTimes(1);
      expect(reportsService.getRevenue).toHaveBeenCalledTimes(1);
    });

    it('re-reads the open tab when the filter changes, and forgets the others', async () => {
      // The cached tabs answer for the old date range, so keeping them would show one tab's
      // numbers from the new filter next to another tab's from the old one.
      await component.loadActiveReport();
      component.onTabIndexChange(1);
      await Promise.resolve();

      component.onFilterApply();
      await Promise.resolve();
      component.onTabIndexChange(0);
      await Promise.resolve();

      expect(reportsService.getRevenue).toHaveBeenCalledTimes(2);
      expect(reportsService.getOccupancy).toHaveBeenCalledTimes(2);
    });
  });

  describe('date presets', () => {
    it('sends the range as an end-exclusive window, so the last day is included', async () => {
      component.setDatePreset('today');
      await Promise.resolve();

      expect(reportsService.getOccupancy).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-05-20', to: '2026-05-21' }),
      );
    });

    it('covers the whole of the previous calendar month', async () => {
      component.setDatePreset('lastMonth');
      await Promise.resolve();

      expect(reportsService.getOccupancy).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-04-01', to: '2026-05-01' }),
      );
    });

    it('counts last7 inclusively of today', async () => {
      component.setDatePreset('last7');
      await Promise.resolve();

      expect(reportsService.getOccupancy).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-05-14', to: '2026-05-21' }),
      );
    });

    it('keeps the preset highlighted after applying it', () => {
      component.setDatePreset('thisYear');

      expect(component['filterDatePreset']()).toBe('thisYear');
    });
  });

  describe('chart data', () => {
    it('renders empty rather than throwing before a report has arrived', () => {
      expect(component['occupancyChartData']().labels).toEqual([]);
      expect(component['revenueDailyChartData']().labels).toEqual([]);
      expect(component['customersChartData']().labels).toEqual([]);
    });

    it('draws the occupancy line in the accent colour the branding sets', () => {
      component['occupancy'].set({
        daily: [{ date: '2026-05-01', occupancyRate: 42 }],
      } as never);

      const [dataset] = component['occupancyChartData']().datasets;

      expect(dataset.data).toEqual([42]);
      expect(dataset.borderColor).toBe(component['chartColors']()[0]);
    });
  });
});
