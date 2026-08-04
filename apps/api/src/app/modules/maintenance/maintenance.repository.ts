import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MaintenanceRecord, MaintenancePriority, MaintenanceStatus, Prisma } from '../../../generated/prisma/client';

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

  update(
    id: string,
    data: Prisma.MaintenanceRecordUncheckedUpdateInput,
  ): Promise<MaintenanceRecord> {
    return this.prisma.maintenanceRecord.update({ where: { id }, data });
  }
}
