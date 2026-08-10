import { CreateReservationInput } from '../models/reservation.model';

export type SyncOperationType = 'create-reservation' | 'update-reservation' | 'cancel-reservation';

export type SyncItemStatus = 'pending' | 'syncing' | 'conflict';

/** Local-id references to a not-yet-synced create are prefixed so they're distinguishable from real UUIDs. */
export const LOCAL_ID_PREFIX = 'local:';

export interface UpdateReservationPayload {
  guestCount?: number;
  notes?: string;
}

export type SyncOutboxPayload =
  CreateReservationInput | UpdateReservationPayload | Record<string, never>;

export interface SyncOutboxItem {
  id: string;
  type: SyncOperationType;
  payload: SyncOutboxPayload;
  /** Human-readable label for the panel, e.g. "Villa Deniz / Kat 2 · Ada Lovelace" — captured at enqueue time since the outbox only otherwise holds ids. */
  summary: string;
  createdAt: string;
  status: SyncItemStatus;
  attempts: number;
  /** For update/cancel: the target reservation id, or `local:<outboxItemId>` while it depends on a still-queued create. */
  targetReservationId?: string;
  /** For update: the updatedAt the client read before editing, used for the server's stale-write check. */
  expectedUpdatedAt?: string;
  /** Populated once an item is created — lets the panel show what the user originally typed when a conflict needs re-entry. */
  conflictingReservationId?: string;
  errorMessage?: string;
}

export const SYNC_QUEUE_MAX_ITEMS = 50;
export const SYNC_QUEUE_MAX_ATTEMPTS = 5;
