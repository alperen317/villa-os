import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { ApiErrorService } from '../../core/i18n/api-error.service';
import { SettingsStore } from '../settings/settings.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiError = inject(ApiErrorService);
  protected readonly settingsStore = inject(SettingsStore);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.form.getRawValue();

    try {
      await this.authService.login(username, password);
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      // Distinguishes bad credentials from a rate-limited address — telling the
      // user to wait a minute is very different advice from "check your password".
      this.errorMessage.set(this.apiError.message(error));
    } finally {
      this.loading.set(false);
    }
  }
}
