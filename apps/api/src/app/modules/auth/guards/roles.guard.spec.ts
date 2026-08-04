import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AccessTokenPayload } from '../jwt-payload.interface';
import { UserRole } from '../../../../generated/prisma/client';

function buildContext(user: AccessTokenPayload): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows the request when the route declares no required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext({ sub: 'u1', username: 'x', role: 'Housekeeping' as UserRole });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the route declares an empty roles list', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = buildContext({ sub: 'u1', username: 'x', role: 'Housekeeping' as UserRole });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the user role is in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue(['Administrator', 'Operations']);
    const context = buildContext({ sub: 'u1', username: 'x', role: 'Operations' as UserRole });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies the request when the user role is not in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue(['Administrator']);
    const context = buildContext({ sub: 'u1', username: 'x', role: 'Housekeeping' as UserRole });

    expect(guard.canActivate(context)).toBe(false);
  });
});
