import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CONFIGURABLE_ROLES, ConfigurableRole, PERMISSION_CATALOG } from './permission-catalog';

export interface PermissionRow {
  key: string;
  module: string;
  label: string;
  values: Record<ConfigurableRole, boolean>;
}

export interface PermissionUpdateInput {
  role: string;
  permissionKey: string;
  allowed: boolean;
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  private cache = new Map<ConfigurableRole, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.buildCache();
  }

  isAllowed(role: ConfigurableRole, key: string): boolean {
    return this.cache.get(role)?.has(key) ?? false;
  }

  async getMatrix(): Promise<PermissionRow[]> {
    return PERMISSION_CATALOG.map((definition) => ({
      key: definition.key,
      module: definition.module,
      label: definition.label,
      values: Object.fromEntries(
        CONFIGURABLE_ROLES.map((role) => [role, this.isAllowed(role, definition.key)]),
      ) as Record<ConfigurableRole, boolean>,
    }));
  }

  async updateMatrix(updates: PermissionUpdateInput[]): Promise<PermissionRow[]> {
    for (const update of updates) {
      if (!CONFIGURABLE_ROLES.includes(update.role as ConfigurableRole)) {
        throw new BadRequestException(`Rol için izinler değiştirilemez: ${update.role}`);
      }
    }

    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.rolePermission.upsert({
          where: { role_permissionKey: { role: update.role as ConfigurableRole, permissionKey: update.permissionKey } },
          create: { role: update.role as ConfigurableRole, permissionKey: update.permissionKey, allowed: update.allowed },
          update: { allowed: update.allowed },
        }),
      ),
    );

    await this.buildCache();
    return this.getMatrix();
  }

  private async buildCache(): Promise<void> {
    const nextCache = new Map<ConfigurableRole, Set<string>>();
    for (const role of CONFIGURABLE_ROLES) {
      const defaults = new Set(
        PERMISSION_CATALOG.filter((definition) => definition.defaults[role]).map((definition) => definition.key),
      );
      nextCache.set(role, defaults);
    }

    const rows = await this.prisma.rolePermission.findMany();
    for (const row of rows) {
      const role = row.role as ConfigurableRole;
      if (!nextCache.has(role)) {
        continue;
      }
      if (row.allowed) {
        nextCache.get(role)!.add(row.permissionKey);
      } else {
        nextCache.get(role)!.delete(row.permissionKey);
      }
    }

    this.cache = nextCache;
  }
}
