import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Villa } from '../../core/models/villa.model';
import { VillasService } from './villas.service';

type VillasState = {
  villas: Villa[];
  loading: boolean;
  loaded: boolean;
};

const initialState: VillasState = {
  villas: [],
  loading: false,
  loaded: false,
};

/** The API's hard ceiling on `limit` (see PaginationQueryDto) — the fewest round trips. */
const PAGE_SIZE = 100;

/**
 * This store backs the villa dropdowns on every filter bar and form, so a short read here
 * shows up as villas that simply aren't offered — no empty state, no "showing 100 of 130",
 * just an option that isn't there. Fetching a single capped page was fine while no operator
 * had more than a hundred villas and silently wrong the day one did, so the pages are
 * drained instead.
 */
async function fetchAllVillas(villasService: VillasService): Promise<Villa[]> {
  const first = await villasService.list({ page: 1, limit: PAGE_SIZE });
  const villas = [...first.data];
  const pageCount = Math.ceil(first.total / PAGE_SIZE);

  for (let page = 2; page <= pageCount; page++) {
    const next = await villasService.list({ page, limit: PAGE_SIZE });
    if (next.data.length === 0) break;
    villas.push(...next.data);
  }

  return villas;
}

export const VillasStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, villasService = inject(VillasService)) => ({
    async ensureLoaded(): Promise<void> {
      if (store.loaded() || store.loading()) {
        return;
      }

      patchState(store, { loading: true });
      try {
        patchState(store, { villas: await fetchAllVillas(villasService), loaded: true });
      } finally {
        patchState(store, { loading: false });
      }
    },

    async refresh(): Promise<void> {
      patchState(store, { loading: true });
      try {
        patchState(store, { villas: await fetchAllVillas(villasService), loaded: true });
      } finally {
        patchState(store, { loading: false });
      }
    },
  })),
);
