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
        const result = await villasService.list({ limit: 100 });
        patchState(store, { villas: result.data, loaded: true });
      } finally {
        patchState(store, { loading: false });
      }
    },

    async refresh(): Promise<void> {
      patchState(store, { loading: true });
      try {
        const result = await villasService.list({ limit: 100 });
        patchState(store, { villas: result.data, loaded: true });
      } finally {
        patchState(store, { loading: false });
      }
    },
  })),
);
