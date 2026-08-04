import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma, Villa, VillaStatus } from '../../../generated/prisma/client';

@Injectable()
export class VillasRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.VillaUncheckedCreateInput): Promise<Villa> {
    return this.prisma.villa.create({ data });
  }

  findById(id: string): Promise<Villa | null> {
    return this.prisma.villa.findFirst({ where: { id, deletedAt: null } });
  }

  findMany(params: { skip: number; take: number; status?: VillaStatus }): Promise<Villa[]> {
    return this.prisma.villa.findMany({
      where: { deletedAt: null, status: params.status },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(params: { status?: VillaStatus }): Promise<number> {
    return this.prisma.villa.count({ where: { deletedAt: null, status: params.status } });
  }

  async findVillaIdsWithOpenMaintenance(villaIds: string[]): Promise<Set<string>> {
    if (villaIds.length === 0) {
      return new Set();
    }

    const records = await this.prisma.maintenanceRecord.findMany({
      where: { villaId: { in: villaIds }, status: { not: 'Completed' } },
      select: { villaId: true },
      distinct: ['villaId'],
    });

    return new Set(records.map((record) => record.villaId));
  }

  update(id: string, data: Prisma.VillaUncheckedUpdateInput): Promise<Villa> {
    return this.prisma.villa.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Villa> {
    return this.prisma.villa.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
