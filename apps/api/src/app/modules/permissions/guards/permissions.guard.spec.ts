import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../permissions.service';
import { PermissionsGuard } from './permissions.guard';

function buildContext(role: string): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'user-1', username: 'x', role } }) }),
  } as unknown as ExecutionContext;
}

function buildReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
}

describe('PermissionsGuard', () => {
  let permissionsService: jest.Mocked<PermissionsService>;

  beforeEach(() => {
    permissionsService = { isAllowed: jest.fn() } as unknown as jest.Mocked<PermissionsService>;
  });

  it('allows any authenticated user through when neither @RequirePermission nor @AdminOnly is set', () => {
    const guard = new PermissionsGuard(buildReflector({}), permissionsService);

    expect(guard.canActivate(buildContext('Housekeeping'))).toBe(true);
    expect(permissionsService.isAllowed).not.toHaveBeenCalled();
  });

  it('always allows Administrator, regardless of the permission matrix', () => {
    const reflector = buildReflector({ [PERMISSION_KEY]: 'villas.write' });
    const guard = new PermissionsGuard(reflector, permissionsService);

    expect(guard.canActivate(buildContext('Administrator'))).toBe(true);
    expect(permissionsService.isAllowed).not.toHaveBeenCalled();
  });

  it('defers to PermissionsService for non-admin roles on @RequirePermission routes', () => {
    const reflector = buildReflector({ [PERMISSION_KEY]: 'villas.write' });
    const guard = new PermissionsGuard(reflector, permissionsService);

    permissionsService.isAllowed.mockReturnValue(true);
    expect(guard.canActivate(buildContext('Operations'))).toBe(true);
    expect(permissionsService.isAllowed).toHaveBeenCalledWith('Operations', 'villas.write');

    permissionsService.isAllowed.mockReturnValue(false);
    expect(guard.canActivate(buildContext('Housekeeping'))).toBe(false);
  });

  it('rejects non-Administrator roles on @AdminOnly routes without consulting the matrix', () => {
    const reflector = buildReflector({ [ADMIN_ONLY_KEY]: true });
    const guard = new PermissionsGuard(reflector, permissionsService);

    expect(guard.canActivate(buildContext('Operations'))).toBe(false);
    expect(guard.canActivate(buildContext('Administrator'))).toBe(true);
    expect(permissionsService.isAllowed).not.toHaveBeenCalled();
  });
});
