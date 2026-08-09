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
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
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
  CompassOutline,
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
import { DEFAULT_LANGUAGE } from './core/i18n/language';
import { SyncQueueStore } from './core/sync/sync-queue.store';
import { SettingsStore } from './features/settings/settings.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideNzI18n(tr_TR),
    provideTranslateService({
      // useHttpBackend keeps these static files off the auth interceptor: they
      // are served by nginx, not the API, and must not be able to trigger a
      // token refresh or a redirect to /login.
      loader: provideTranslateHttpLoader({
        prefix: 'i18n/',
        suffix: '.json',
        useHttpBackend: true,
      }),
      lang: DEFAULT_LANGUAGE,
      fallbackLang: DEFAULT_LANGUAGE,
    }),
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
      CompassOutline,
    ]),
  ],
};
