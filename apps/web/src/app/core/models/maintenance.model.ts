export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type MaintenanceStatus = 'Open' | 'InProgress' | 'Completed';

export interface MaintenanceRecord {
  id: string;
  villaId: string;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  openedAt: string;
  completedAt: string | null;
}

export interface CreateMaintenanceRecordInput {
  title: string;
  description?: string;
  priority?: MaintenancePriority;
}

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  Low: 'Düşük',
  Medium: 'Orta',
  High: 'Yüksek',
  Urgent: 'Acil',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  Open: 'Açık',
  InProgress: 'Devam Ediyor',
  Completed: 'Tamamlandı',
};
