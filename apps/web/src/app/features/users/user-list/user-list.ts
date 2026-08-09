import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';
import { AppUser } from '../../../core/models/user.model';
import { UsersService } from '../users.service';

const ROLE_LABELS: Record<UserRole, string> = {
  Administrator: 'Yönetici',
  Operations: 'Operasyon',
  Accounting: 'Muhasebe',
  Housekeeping: 'Temizlik',
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  protected readonly authService = inject(AuthService);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roleOptions = ROLE_OPTIONS;

  protected readonly users = signal<AppUser[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected editingUser: AppUser | null = null;

  protected readonly resetModalVisible = signal(false);
  protected readonly resetModalSaving = signal(false);
  protected resettingUser: AppUser | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['Operations' as UserRole, Validators.required],
  });

  protected readonly resetForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.loadPage();
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.usersService.list({
        page: this.pageIndex(),
        limit: this.pageSize(),
      });
      this.users.set(result.data);
      this.total.set(result.total);
    } finally {
      this.loading.set(false);
    }
  }

  onPageIndexChange(index: number): void {
    this.pageIndex.set(index);
    this.loadPage();
  }

  openCreateModal(): void {
    this.editingUser = null;
    this.form.reset({ username: '', password: '', role: 'Operations' as UserRole });
    this.form.controls.username.enable();
    this.form.controls.password.enable();
    this.modalVisible.set(true);
  }

  openEditModal(user: AppUser): void {
    this.editingUser = user;
    this.form.reset({ username: user.username, password: '', role: user.role });
    this.form.controls.username.disable();
    this.form.controls.password.disable();
    this.modalVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.modalSaving.set(true);
    const value = this.form.getRawValue();

    try {
      if (this.editingUser) {
        await this.usersService.update(this.editingUser.id, { role: value.role });
        this.message.success('Kullanıcı güncellendi');
      } else {
        await this.usersService.create(value);
        this.message.success('Kullanıcı oluşturuldu');
      }

      this.modalVisible.set(false);
      await this.loadPage();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error, 'İşlem başarısız oldu'));
    } finally {
      this.modalSaving.set(false);
    }
  }

  isSelf(user: AppUser): boolean {
    return this.authService.currentUser()?.sub === user.id;
  }

  async toggleActive(user: AppUser): Promise<void> {
    try {
      if (user.isActive) {
        await this.usersService.deactivate(user.id);
      } else {
        await this.usersService.activate(user.id);
      }
      await this.loadPage();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error, 'Durum değiştirilemedi'));
    }
  }

  openResetPasswordModal(user: AppUser): void {
    this.resettingUser = user;
    this.resetForm.reset({ password: '' });
    this.resetModalVisible.set(true);
  }

  async resetPassword(): Promise<void> {
    if (this.resetForm.invalid || !this.resettingUser) {
      return;
    }

    this.resetModalSaving.set(true);
    try {
      await this.usersService.resetPassword(
        this.resettingUser.id,
        this.resetForm.getRawValue().password,
      );
      this.message.success('Şifre sıfırlandı');
      this.resetModalVisible.set(false);
    } catch (error) {
      this.message.error(this.extractErrorMessage(error, 'Şifre sıfırlanamadı'));
    } finally {
      this.resetModalSaving.set(false);
    }
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return fallback;
  }
}
