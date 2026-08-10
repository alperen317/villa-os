import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../../core/auth/auth.service';
import { AppUser } from '../../../core/models/user.model';
import { UsersService } from '../users.service';
import { UserList } from './user-list';

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'user-1',
    username: 'ada',
    role: 'Operations',
    isActive: true,
    ...overrides,
  } as AppUser;
}

describe('UserList', () => {
  let component: UserList;
  let usersService: {
    list: jest.Mock;
    create: jest.Mock;
    updateRole: jest.Mock;
    activate: jest.Mock;
    deactivate: jest.Mock;
    resetPassword: jest.Mock;
  };
  let currentUser: ReturnType<typeof signal<{ sub: string } | null>>;
  let message: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    usersService = {
      list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      create: jest.fn().mockResolvedValue(user()),
      updateRole: jest.fn().mockResolvedValue(user()),
      activate: jest.fn().mockResolvedValue(user()),
      deactivate: jest.fn().mockResolvedValue(user({ isActive: false })),
      resetPassword: jest.fn().mockResolvedValue(undefined),
    };
    currentUser = signal<{ sub: string } | null>({ sub: 'user-me' });
    message = { success: jest.fn(), error: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: { currentUser } },
        { provide: NzMessageService, useValue: message },
      ],
    });

    component = TestBed.runInInjectionContext(() => new UserList());
  });

  describe('isSelf', () => {
    it('recognises the signed-in user, which is what disables locking yourself out', () => {
      expect(component.isSelf(user({ id: 'user-me' }))).toBe(true);
      expect(component.isSelf(user({ id: 'user-other' }))).toBe(false);
    });

    it('matches nobody when there is no session rather than everybody', () => {
      currentUser.set(null);

      expect(component.isSelf(user({ id: 'user-me' }))).toBe(false);
    });
  });

  describe('toggleActive', () => {
    it('deactivates an active user and re-reads the page', async () => {
      await component.toggleActive(user({ isActive: true }));

      expect(usersService.deactivate).toHaveBeenCalledWith('user-1');
      expect(usersService.activate).not.toHaveBeenCalled();
      expect(usersService.list).toHaveBeenCalled();
    });

    it('activates an inactive one', async () => {
      await component.toggleActive(user({ isActive: false }));

      expect(usersService.activate).toHaveBeenCalledWith('user-1');
      expect(usersService.deactivate).not.toHaveBeenCalled();
    });

    it('surfaces the API refusal instead of leaving the row looking changed', async () => {
      usersService.deactivate.mockRejectedValue(
        new HttpErrorResponse({
          status: 409,
          error: { message: 'Son yönetici devre dışı bırakılamaz' },
        }),
      );

      await component.toggleActive(user({ isActive: true }));

      expect(message.error).toHaveBeenCalledWith('Son yönetici devre dışı bırakılamaz');
    });

    it('falls back to its own wording for a failure that carries no message', async () => {
      // Only an HttpErrorResponse is trusted to carry one — an offline TypeError must not
      // have its internals shown to the user.
      usersService.deactivate.mockRejectedValue(new TypeError('Failed to fetch'));

      await component.toggleActive(user({ isActive: true }));

      expect(message.error).toHaveBeenCalledWith('Durum değiştirilemedi');
    });
  });

  describe('the edit modal', () => {
    it('locks username and password, which only the create form may set', () => {
      component.openEditModal(user({ username: 'ada', role: 'Accounting' }));

      expect(component['form'].controls.username.disabled).toBe(true);
      expect(component['form'].controls.password.disabled).toBe(true);
      expect(component['form'].getRawValue().role).toBe('Accounting');
    });

    it('re-enables both when the create modal is opened afterwards', () => {
      component.openEditModal(user());
      component.openCreateModal();

      expect(component['form'].controls.username.enabled).toBe(true);
      expect(component['form'].controls.password.enabled).toBe(true);
      expect(component['form'].getRawValue().username).toBe('');
    });
  });

  describe('resetPassword', () => {
    it('does nothing when no user is selected, rather than posting to undefined', async () => {
      component['resetForm'].setValue({ password: 'a-long-enough-password' });

      await component.resetPassword();

      expect(usersService.resetPassword).not.toHaveBeenCalled();
    });

    it('sends the new password for the selected user and closes the modal', async () => {
      component.openResetPasswordModal(user({ id: 'user-7' }));
      component['resetForm'].setValue({ password: 'a-long-enough-password' });

      await component.resetPassword();

      expect(usersService.resetPassword).toHaveBeenCalledWith('user-7', 'a-long-enough-password');
      expect(component['resetModalVisible']()).toBe(false);
    });

    it('keeps the modal open when the reset fails, so the input is not lost', async () => {
      usersService.resetPassword.mockRejectedValue(new Error('nope'));
      component.openResetPasswordModal(user({ id: 'user-7' }));
      component['resetForm'].setValue({ password: 'a-long-enough-password' });

      await component.resetPassword();

      expect(component['resetModalVisible']()).toBe(true);
      expect(component['resetModalSaving']()).toBe(false);
    });
  });
});
