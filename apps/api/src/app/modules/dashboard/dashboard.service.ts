import { Injectable } from '@nestjs/common';
import { subtractMoney } from '../../common/money';
import { DashboardRepository } from './dashboard.repository';

export interface DashboardSummary {
  todayArrivals: number;
  todayDepartures: number;
  currentGuests: number;
  occupiedVillas: number;
  totalActiveVillas: number;
  occupancyRate: number;
  revenueThisMonth: number;
  expensesThisMonth: number;
  /** Revenue minus expenses for the same month; negative is a real answer. */
  netThisMonth: number;
  openCleaningTasks: number;
  openMaintenanceTasks: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [
      todayArrivals,
      todayDepartures,
      currentGuests,
      occupiedVillas,
      totalActiveVillas,
      revenueThisMonth,
      expensesThisMonth,
      openCleaningTasks,
      openMaintenanceTasks,
    ] = await Promise.all([
      this.dashboardRepository.countArrivalsToday(now),
      this.dashboardRepository.countDeparturesToday(now),
      this.dashboardRepository.sumCurrentGuests(),
      this.dashboardRepository.countOccupiedVillas(),
      this.dashboardRepository.countActiveVillas(),
      this.dashboardRepository.sumRevenueThisMonth(monthStart, monthEnd),
      this.dashboardRepository.sumExpensesThisMonth(monthStart, monthEnd),
      this.dashboardRepository.countOpenHousekeepingTasks(),
      this.dashboardRepository.countOpenMaintenanceRecords(),
    ]);

    return {
      todayArrivals,
      todayDepartures,
      currentGuests,
      occupiedVillas,
      totalActiveVillas,
      occupancyRate: this.calculateOccupancyRate(occupiedVillas, totalActiveVillas),
      revenueThisMonth,
      expensesThisMonth,
      netThisMonth: subtractMoney(revenueThisMonth, expensesThisMonth),
      openCleaningTasks,
      openMaintenanceTasks,
    };
  }

  calculateOccupancyRate(occupiedVillas: number, totalActiveVillas: number): number {
    if (totalActiveVillas === 0) {
      return 0;
    }

    return Math.round((occupiedVillas / totalActiveVillas) * 100);
  }
}
