export type ReservationStatus =
  | 'Pending'
  | 'Confirmed'
  | 'CheckedIn'
  | 'CheckedOut'
  | 'Completed'
  | 'Cancelled';

export interface Reservation {
  id: string;
  reservationNumber: string;
  villaId: string;
  floorId: string;
  customerId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalPrice: string;
  status: ReservationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  villa: { id: string; name: string };
  floor: { id: string; name: string; isEntireVilla: boolean };
  customer: { id: string; firstName: string; lastName: string };
}

export interface CreateReservationInput {
  customerId: string;
  villaId: string;
  floorId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  notes?: string;
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  Pending: 'Beklemede',
  Confirmed: 'Onaylandı',
  CheckedIn: 'Giriş Yapıldı',
  CheckedOut: 'Çıkış Yapıldı',
  Completed: 'Tamamlandı',
  Cancelled: 'İptal Edildi',
};

export const RESERVATION_NEXT_ACTIONS: Record<
  ReservationStatus,
  { action: string; label: string }[]
> = {
  Pending: [
    { action: 'confirm', label: 'Onayla' },
    { action: 'cancel', label: 'İptal Et' },
  ],
  Confirmed: [
    { action: 'check-in', label: 'Giriş Yap' },
    { action: 'cancel', label: 'İptal Et' },
  ],
  CheckedIn: [{ action: 'check-out', label: 'Çıkış Yap' }],
  CheckedOut: [{ action: 'complete', label: 'Tamamla' }],
  Completed: [],
  Cancelled: [],
};
