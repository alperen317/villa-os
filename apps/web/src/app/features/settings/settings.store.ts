import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { API_ORIGIN } from '../../core/api-base-url';
import { Settings, UpdateSettingsInput } from '../../core/models/settings.model';
import { SettingsService } from './settings.service';

const DEFAULT_COMPANY_NAME = 'Villa OS';
const DEFAULT_ACCENT_COLOR = '#2563eb';

type SettingsState = {
  settings: Settings | null;
  loading: boolean;
  loaded: boolean;
};

const initialState: SettingsState = {
  settings: null,
  loading: false,
  loaded: false,
};

/** Pushes the brand color onto the CSS custom property every other token derives from. */
function applyAccentColor(accentColor: string): void {
  document.documentElement.style.setProperty('--color-accent', accentColor);
}

export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ settings }) => ({
    companyName: computed(() => settings()?.companyName || DEFAULT_COMPANY_NAME),
    logoUrl: computed(() => {
      const logoPath = settings()?.logoPath;
      return logoPath ? `${API_ORIGIN}${logoPath}` : null;
    }),
  })),
  withMethods((store, settingsService = inject(SettingsService)) => ({
    async ensureLoaded(): Promise<void> {
      if (store.loaded() || store.loading()) {
        return;
      }

      patchState(store, { loading: true });
      try {
        const settings = await settingsService.get();
        patchState(store, { settings, loaded: true });
        applyAccentColor(settings.accentColor || DEFAULT_ACCENT_COLOR);
      } catch {
        // Branding is non-critical — fall back to defaults rather than blocking app bootstrap.
      } finally {
        patchState(store, { loading: false });
      }
    },

    async refresh(): Promise<void> {
      const settings = await settingsService.get();
      patchState(store, { settings, loaded: true });
      applyAccentColor(settings.accentColor || DEFAULT_ACCENT_COLOR);
    },

    async update(input: UpdateSettingsInput): Promise<void> {
      const settings = await settingsService.update(input);
      patchState(store, { settings });
      applyAccentColor(settings.accentColor || DEFAULT_ACCENT_COLOR);
    },

    async uploadLogo(file: File): Promise<void> {
      const settings = await settingsService.uploadLogo(file);
      patchState(store, { settings });
    },

    async removeLogo(): Promise<void> {
      const settings = await settingsService.removeLogo();
      patchState(store, { settings });
    },
  })),
);
