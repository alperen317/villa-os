export interface DashboardSummary {
  todayArrivals: number;
  todayDepartures: number;
  currentGuests: number;
  occupiedVillas: number;
  totalActiveVillas: number;
  occupancyRate: number;
  revenueThisMonth: number;
  expensesThisMonth: number;
  /** Revenue minus expenses for the same month; can be negative. */
  netThisMonth: number;
  openCleaningTasks: number;
  openMaintenanceTasks: number;
}
