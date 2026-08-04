import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function buildContext(): ExecutionContext {
  return { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('bypasses authentication for routes marked @Public()', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('delegates to the JWT passport strategy for routes that are not public', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);

    // JwtAuthGuard extends AuthGuard('jwt'); spy on that exact base prototype
    // rather than re-deriving AuthGuard('jwt'), which may not be the same class.
    const basePrototype = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const superCanActivate = jest
      .spyOn(basePrototype, 'canActivate')
      .mockReturnValue(true as never);

    expect(guard.canActivate(buildContext())).toBe(true);
    expect(superCanActivate).toHaveBeenCalledTimes(1);

    superCanActivate.mockRestore();
  });
});
