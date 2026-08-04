import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { HousekeepingStatus, Prisma } from '../../../generated/prisma/client';

const HOUSEKEEPING_TASK_INCLUDE = {
  villa: { select: { id: true, name: true } },
  reservation: { select: { id: true, reservationNumber: true } },
  assignedUser: { select: { id: true, username: true } },
} satisfies Prisma.HousekeepingTaskInclude;

export type HousekeepingTaskWithRelations = Prisma.HousekeepingTaskGetPayload<{
  include: typeof HOUSEKEEPING_TASK_INCLUDE;
}>;

@Injectable()
export class HousekeepingRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.HousekeepingTaskUncheckedCreateInput): Promise<HousekeepingTaskWithRelations> {
    return this.prisma.housekeepingTask.create({ data, include: HOUSEKEEPING_TASK_INCLUDE });
  }

  findById(id: string): Promise<HousekeepingTaskWithRelations | null> {
    return this.prisma.housekeepingTask.findFirst({
      where: { id },
      include: HOUSEKEEPING_TASK_INCLUDE,
    });
  }

  findMany(params: {
    villaId?: string;
    status?: HousekeepingStatus;
  }): Promise<HousekeepingTaskWithRelations[]> {
    return this.prisma.housekeepingTask.findMany({
      where: { villaId: params.villaId, status: params.status },
      include: HOUSEKEEPING_TASK_INCLUDE,
    });
  }

  update(
    id: string,
    data: Prisma.HousekeepingTaskUncheckedUpdateInput,
  ): Promise<HousekeepingTaskWithRelations> {
    return this.prisma.housekeepingTask.update({
      where: { id },
      data,
      include: HOUSEKEEPING_TASK_INCLUDE,
    });
  }
}
