import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma, Settings } from '../../../generated/prisma/client';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findFirst(): Promise<Settings | null> {
    return this.prisma.settings.findFirst();
  }

  create(data: Prisma.SettingsCreateInput): Promise<Settings> {
    return this.prisma.settings.create({ data });
  }

  update(id: string, data: Prisma.SettingsUpdateInput): Promise<Settings> {
    return this.prisma.settings.update({ where: { id }, data });
  }
}
