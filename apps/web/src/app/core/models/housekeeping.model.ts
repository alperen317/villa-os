export type HousekeepingStatus = 'Pending' | 'InProgress' | 'Completed';

export interface HousekeepingTask {
  id: string;
  reservationId: string | null;
  villaId: string;
  assignedUserId: string | null;
  status: HousekeepingStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  villa: { id: string; name: string };
  reservation: { id: string; reservationNumber: string } | null;
  assignedUser: { id: string; username: string } | null;
}

export interface CreateHousekeepingTaskInput {
  villaId: string;
  notes?: string;
}

export const HOUSEKEEPING_STATUS_LABELS: Record<HousekeepingStatus, string> = {
  Pending: 'Bekliyor',
  InProgress: 'Temizleniyor',
  Completed: 'Tamamlandı',
};
