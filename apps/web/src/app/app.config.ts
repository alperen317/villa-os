import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNzI18n, tr_TR } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzNativeDateAdapter } from 'ng-zorro-antd/core/time';
import {
  AppstoreOutline,
  CalendarOutline,
  CheckCircleOutline,
  ClearOutline,
  ClockCircleOutline,
  CloseCircleOutline,
  DashboardOutline,
  DeleteOutline,
  EditOutline,
  EyeOutline,
  HomeOutline,
  LeftOutline,
  LockOutline,
  LoginOutline,
  LogoutOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  MoreOutline,
  PlusOutline,
  SearchOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideNzI18n(tr_TR),
    provideNzNativeDateAdapter(),
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
    ]),
  ],
};
