export type HousekeepingStatus = 'Pending' | 'InProgress' | 'Completed';

export interface HousekeepingTask {
  id: string;
  reservationId: string;
  villaId: string;
  assignedUserId: string | null;
  status: HousekeepingStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  villa: { id: string; name: string };
  reservation: { id: string; reservationNumber: string };
  assignedUser: { id: string; username: string } | null;
}

export const HOUSEKEEPING_STATUS_LABELS: Record<HousekeepingStatus, string> = {
  Pending: 'Bekliyor',
  InProgress: 'Temizleniyor',
  Completed: 'Tamamlandı',
};
