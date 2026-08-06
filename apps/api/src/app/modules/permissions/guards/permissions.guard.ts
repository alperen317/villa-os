import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { ConfigurableRole } from '../permission-catalog';
import { PermissionsService } from '../permissions.service';
import { UserRole } from '../../../../generated/prisma/client';
import { AccessTokenPayload } from '../../auth/jwt-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: AccessTokenPayload }>();

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (adminOnly) {
      return user.role === UserRole.Administrator;
    }

    const key = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!key) {
      return true;
    }

    if (user.role === UserRole.Administrator) {
      return true;
    }

    return this.permissionsService.isAllowed(user.role as ConfigurableRole, key);
  }
}
