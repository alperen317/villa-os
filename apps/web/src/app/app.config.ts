import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideNzI18n, tr_TR } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzNativeDateAdapter } from 'ng-zorro-antd/core/time';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import {
  AppstoreOutline,
  CalendarOutline,
  CheckCircleOutline,
  CheckOutline,
  ClearOutline,
  ClockCircleOutline,
  CloseCircleOutline,
  CloseOutline,
  DashboardOutline,
  DeleteOutline,
  DollarOutline,
  EditOutline,
  EyeOutline,
  HomeOutline,
  LeftOutline,
  LockOutline,
  LoginOutline,
  LogoutOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  MobileOutline,
  MoreOutline,
  PictureOutline,
  PlusOutline,
  RightOutline,
  SearchOutline,
  SettingOutline,
  SyncOutline,
  TeamOutline,
  ToolOutline,
  UploadOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { SyncQueueStore } from './core/sync/sync-queue.store';
import { SettingsStore } from './features/settings/settings.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideNzI18n(tr_TR),
    provideNzNativeDateAdapter(),
    provideCharts(withDefaultRegisterables()),
    provideAppInitializer(() => inject(SettingsStore).ensureLoaded()),
    provideAppInitializer(() => {
      const syncQueueStore = inject(SyncQueueStore);
      window.addEventListener('online', () => syncQueueStore.replay());
      return syncQueueStore.initialize().then(() => {
        void syncQueueStore.replay();
      });
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideNzIcons([
      UserOutline,
      LockOutline,
      LoginOutline,
      LogoutOutline,
      CheckCircleOutline,
      CloseCircleOutline,
      DashboardOutline,
      HomeOutline,
      CalendarOutline,
      PlusOutline,
      EditOutline,
      DeleteOutline,
      EyeOutline,
      MoreOutline,
      MenuFoldOutline,
      MenuUnfoldOutline,
      SearchOutline,
      AppstoreOutline,
      LeftOutline,
      ClockCircleOutline,
      ClearOutline,
      ToolOutline,
      DollarOutline,
      TeamOutline,
      RightOutline,
      SettingOutline,
      PictureOutline,
      UploadOutline,
      CheckOutline,
      SyncOutline,
      MobileOutline,
      CloseOutline,
    ]),
  ],
};
