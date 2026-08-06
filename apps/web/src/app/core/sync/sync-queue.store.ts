import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { CreateReservationInput, Reservation } from '../models/reservation.model';
import {
  LOCAL_ID_PREFIX,
  SYNC_QUEUE_MAX_ATTEMPTS,
  SYNC_QUEUE_MAX_ITEMS,
  SyncOutboxItem,
  UpdateReservationPayload,
} from './sync-queue.model';
import { syncOutboxDb } from './sync-outbox.db';

type SyncQueueState = {
  items: SyncOutboxItem[];
  loaded: boolean;
  syncing: boolean;
  sessionExpired: boolean;
  /** Set when the user picks a conflicted item in the panel to resolve — the item is pulled out
   *  of the outbox at that point, since resolving it turns into a normal foreground form submit. */
  resolveTarget: SyncOutboxItem | null;
};

const initialState: SyncQueueState = {
  items: [],
  loaded: false,
  syncing: false,
  sessionExpired: false,
  resolveTarget: null,
};

function sortByCreatedAt(items: SyncOutboxItem[]): SyncOutboxItem[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const SyncQueueStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ items }) => ({
    pendingCount: computed(() => items().filter((item) => item.status !== 'conflict').length),
    conflictCount: computed(() => items().filter((item) => item.status === 'conflict').length),
    totalCount: computed(() => items().length),
  })),
  withMethods((store, http = inject(HttpClient)) => {
    async function persist(item: SyncOutboxItem): Promise<void> {
      await syncOutboxDb.put(item);
      patchState(store, { items: sortByCreatedAt([...store.items().filter((i) => i.id !== item.id), item]) });
    }

    async function remove(id: string): Promise<void> {
      await syncOutboxDb.delete(id);
      patchState(store, { items: store.items().filter((item) => item.id !== id) });
    }

    /** Dependent update/cancel ops enqueued before their create synced were pointed at `local:<createId>` — swap in the real id now that it exists. */
    async function resolveDependents(createLocalId: string, realReservationId: string): Promise<void> {
      const dependents = store.items().filter(
        (item) => item.targetReservationId === `${LOCAL_ID_PREFIX}${createLocalId}`,
      );
      for (const dependent of dependents) {
        await persist({ ...dependent, targetReservationId: realReservationId });
      }
    }

    async function syncCreate(item: SyncOutboxItem): Promise<void> {
      try {
        const created = await firstValueFrom(
          http.post<Reservation>(`${API_BASE_URL}/reservations`, item.payload, {
            headers: { 'Idempotency-Key': item.id },
          }),
        );
        await resolveDependents(item.id, created.id);
        await remove(item.id);
      } catch (error) {
        await handleSyncError(item, error);
      }
    }

    async function syncUpdate(item: SyncOutboxItem): Promise<void> {
      const targetId = item.targetReservationId;
      if (!targetId || targetId.startsWith(LOCAL_ID_PREFIX)) {
        // Still blocked behind a queued/conflicted create — try again on the next replay pass.
        return;
      }

      try {
        const payload = item.payload as UpdateReservationPayload;
        await firstValueFrom(
          http.patch<Reservation>(`${API_BASE_URL}/reservations/${targetId}`, {
            ...payload,
            expectedUpdatedAt: item.expectedUpdatedAt,
          }),
        );
        await remove(item.id);
      } catch (error) {
        await handleSyncError(item, error);
      }
    }

    async function syncCancel(item: SyncOutboxItem): Promise<void> {
      const targetId = item.targetReservationId;
      if (!targetId || targetId.startsWith(LOCAL_ID_PREFIX)) {
        return;
      }

      try {
        await firstValueFrom(http.post(`${API_BASE_URL}/reservations/${targetId}/cancel`, {}));
        await remove(item.id);
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          const message = typeof error.error?.message === 'string' ? error.error.message : '';
          if (/from Cancelled to Cancelled/.test(message)) {
            // Already cancelled (e.g. cancelled from another device) — the user's intent is already satisfied.
            await remove(item.id);
            return;
          }
        }
        await handleSyncError(item, error);
      }
    }

    async function handleSyncError(item: SyncOutboxItem, error: unknown): Promise<void> {
      if (!(error instanceof HttpErrorResponse)) {
        await persist({ ...item, status: 'pending', attempts: item.attempts + 1 });
        return;
      }

      if (error.status === 401) {
        patchState(store, { sessionExpired: true });
        await persist({ ...item, status: 'pending' });
        return;
      }

      if (error.status === 409 || error.status === 400) {
        const conflictingReservationId =
          typeof error.error?.conflictingReservationId === 'string'
            ? error.error.conflictingReservationId
            : undefined;
        const errorMessage = typeof error.error?.message === 'string' ? error.error.message : 'Çakışma tespit edildi';
        await persist({ ...item, status: 'conflict', conflictingReservationId, errorMessage });
        return;
      }

      const attempts = item.attempts + 1;
      if (attempts >= SYNC_QUEUE_MAX_ATTEMPTS) {
        await persist({
          ...item,
          status: 'conflict',
          attempts,
          errorMessage: 'Sunucuya ulaşılamadı, tekrar deneme sayısı aşıldı',
        });
        return;
      }

      await persist({ ...item, status: 'pending', attempts });
    }

    async function syncOne(item: SyncOutboxItem): Promise<void> {
      const syncingItem: SyncOutboxItem = { ...item, status: 'syncing' };
      await persist(syncingItem);

      switch (item.type) {
        case 'create-reservation':
          return syncCreate(syncingItem);
        case 'update-reservation':
          return syncUpdate(syncingItem);
        case 'cancel-reservation':
          return syncCancel(syncingItem);
      }
    }

    return {
      async initialize(): Promise<void> {
        if (store.loaded()) {
          return;
        }

        const stored = await syncOutboxDb.getAll();
        // Anything left "syncing" means the tab closed mid-request — safe to retry from pending
        // because creates are idempotency-keyed and update/cancel are naturally re-appliable.
        const recovered = stored.map((item) =>
          item.status === 'syncing' ? { ...item, status: 'pending' as const } : item,
        );
        await Promise.all(recovered.map((item) => syncOutboxDb.put(item)));

        patchState(store, { items: sortByCreatedAt(recovered), loaded: true });
      },

      async enqueueCreate(payload: CreateReservationInput, summary: string): Promise<SyncOutboxItem> {
        if (store.items().length >= SYNC_QUEUE_MAX_ITEMS) {
          throw new Error('Bekleyen işlem kuyruğu dolu. Lütfen önce senkronize edin.');
        }

        const item: SyncOutboxItem = {
          id: crypto.randomUUID(),
          type: 'create-reservation',
          payload,
          summary,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
        };
        await persist(item);
        return item;
      },

      async enqueueUpdate(
        targetReservationId: string,
        payload: UpdateReservationPayload,
        expectedUpdatedAt: string,
        summary: string,
      ): Promise<SyncOutboxItem> {
        if (store.items().length >= SYNC_QUEUE_MAX_ITEMS) {
          throw new Error('Bekleyen işlem kuyruğu dolu. Lütfen önce senkronize edin.');
        }

        const item: SyncOutboxItem = {
          id: crypto.randomUUID(),
          type: 'update-reservation',
          payload,
          summary,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          targetReservationId,
          expectedUpdatedAt,
        };
        await persist(item);
        return item;
      },

      async enqueueCancel(targetReservationId: string, summary: string): Promise<SyncOutboxItem> {
        if (store.items().length >= SYNC_QUEUE_MAX_ITEMS) {
          throw new Error('Bekleyen işlem kuyruğu dolu. Lütfen önce senkronize edin.');
        }

        const item: SyncOutboxItem = {
          id: crypto.randomUUID(),
          type: 'cancel-reservation',
          payload: {},
          summary,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          targetReservationId,
        };
        await persist(item);
        return item;
      },

      async discard(id: string): Promise<void> {
        await remove(id);
      },

      async requestResolve(item: SyncOutboxItem): Promise<void> {
        await remove(item.id);
        patchState(store, { resolveTarget: item });
      },

      clearResolveTarget(): void {
        patchState(store, { resolveTarget: null });
      },

      async replay(): Promise<void> {
        if (store.syncing() || !navigator.onLine) {
          return;
        }

        patchState(store, { syncing: true, sessionExpired: false });
        try {
          // Re-read each item from the store right before syncing it (not a single upfront
          // snapshot) so a dependent update/cancel sees the real reservation id a create
          // earlier in this same pass just resolved it to.
          const orderedIds = sortByCreatedAt(store.items()).map((item) => item.id);
          for (const id of orderedIds) {
            if (store.sessionExpired()) {
              break;
            }
            const current = store.items().find((item) => item.id === id);
            // Also re-attempt anything still stuck 'syncing' from an interrupted previous pass
            // (not just at app startup) — creates are idempotency-keyed and update/cancel are
            // safe to retry, so treating a stale in-flight item as retriable is self-healing.
            if (!current || (current.status !== 'pending' && current.status !== 'syncing')) {
              continue;
            }
            await syncOne(current);
          }
        } finally {
          patchState(store, { syncing: false });
        }
      },
    };
  }),
);
