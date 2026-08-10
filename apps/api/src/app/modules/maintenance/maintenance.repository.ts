import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  MaintenanceRecord,
  MaintenancePriority,
  MaintenanceStatus,
  Prisma,
} from '../../../generated/prisma/client';

const MAINTENANCE_RECORD_WITH_VILLA_INCLUDE = {
  villa: { select: { id: true, name: true } },
} satisfies Prisma.MaintenanceRecordInclude;

export type MaintenanceRecordWithVilla = Prisma.MaintenanceRecordGetPayload<{
  include: typeof MAINTENANCE_RECORD_WITH_VILLA_INCLUDE;
}>;

@Injectable()
export class MaintenanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MaintenanceRecordUncheckedCreateInput): Promise<MaintenanceRecord> {
    return this.prisma.maintenanceRecord.create({ data });
  }

  findById(id: string): Promise<MaintenanceRecord | null> {
    return this.prisma.maintenanceRecord.findFirst({ where: { id } });
  }

  findManyByVilla(params: {
    villaId: string;
    status?: MaintenanceStatus;
    priority?: MaintenancePriority;
  }): Promise<MaintenanceRecord[]> {
    return this.prisma.maintenanceRecord.findMany({
      where: { villaId: params.villaId, status: params.status, priority: params.priority },
      orderBy: { openedAt: 'desc' },
    });
  }

  findMany(params: {
    skip: number;
    take: number;
    villaId?: string;
    status?: MaintenanceStatus;
    priority?: MaintenancePriority;
  }): Promise<MaintenanceRecordWithVilla[]> {
    return this.prisma.maintenanceRecord.findMany({
      where: { villaId: params.villaId, status: params.status, priority: params.priority },
      include: MAINTENANCE_RECORD_WITH_VILLA_INCLUDE,
      orderBy: { openedAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  count(params: {
    villaId?: string;
    status?: MaintenanceStatus;
    priority?: MaintenancePriority;
  }): Promise<number> {
    return this.prisma.maintenanceRecord.count({
      where: { villaId: params.villaId, status: params.status, priority: params.priority },
    });
  }

  update(
    id: string,
    data: Prisma.MaintenanceRecordUncheckedUpdateInput,
  ): Promise<MaintenanceRecord> {
    return this.prisma.maintenanceRecord.update({ where: { id }, data });
  }

  /**
   * Applies the update only if the record is still on `from`, and reports whether it did.
   *
   * `updateMany` rather than `update` because the status has to be part of the WHERE and
   * Prisma's `update` only matches on unique fields. Null means somebody else moved the
   * record first — a distinction the caller cannot recover once the write has landed.
   */
  async updateFromStatus(
    id: string,
    from: MaintenanceStatus,
    data: Prisma.MaintenanceRecordUncheckedUpdateInput,
  ): Promise<MaintenanceRecord | null> {
    const { count } = await this.prisma.maintenanceRecord.updateMany({
      where: { id, status: from },
      data,
    });

    return count === 0 ? null : this.findById(id);
  }
}
