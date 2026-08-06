import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { PermissionRow, PermissionUpdate } from '../../core/models/permission.model';
import { PermissionsService } from './permissions.service';

type PermissionsState = {
  rows: PermissionRow[];
  loading: boolean;
  loaded: boolean;
};

const initialState: PermissionsState = {
  rows: [],
  loading: false,
  loaded: false,
};

export const PermissionsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, permissionsService = inject(PermissionsService)) => ({
    async ensureLoaded(): Promise<void> {
      if (store.loaded() || store.loading()) {
        return;
      }

      patchState(store, { loading: true });
      try {
        const rows = await permissionsService.get();
        patchState(store, { rows, loaded: true });
      } finally {
        patchState(store, { loading: false });
      }
    },

    async save(updates: PermissionUpdate[]): Promise<void> {
      const rows = await permissionsService.update(updates);
      patchState(store, { rows });
    },
  })),
);
