import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { HousekeepingStatus, Prisma } from '../../../generated/prisma/client';

const HOUSEKEEPING_TASK_INCLUDE = {
  villa: { select: { id: true, name: true } },
  reservation: {
    select: {
      id: true,
      reservationNumber: true,
      floor: { select: { id: true, name: true, isEntireVilla: true } },
    },
  },
  assignedUser: { select: { id: true, username: true } },
} satisfies Prisma.HousekeepingTaskInclude;

export type HousekeepingTaskWithRelations = Prisma.HousekeepingTaskGetPayload<{
  include: typeof HOUSEKEEPING_TASK_INCLUDE;
}>;

@Injectable()
export class HousekeepingRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.HousekeepingTaskUncheckedCreateInput,
  ): Promise<HousekeepingTaskWithRelations> {
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
    statusNot?: HousekeepingStatus;
    take?: number;
    orderBy?: Prisma.HousekeepingTaskOrderByWithRelationInput;
  }): Promise<HousekeepingTaskWithRelations[]> {
    return this.prisma.housekeepingTask.findMany({
      where: {
        villaId: params.villaId,
        status: params.status ?? (params.statusNot ? { not: params.statusNot } : undefined),
      },
      include: HOUSEKEEPING_TASK_INCLUDE,
      take: params.take,
      orderBy: params.orderBy,
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

  /**
   * Applies the update only if the task is still on `from`, and reports whether it did.
   *
   * `updateMany` rather than `update` because the status has to be part of the WHERE and
   * Prisma's `update` only matches on unique fields. Null means somebody else moved the task
   * first — a distinction the caller cannot recover once the write has landed.
   */
  async updateFromStatus(
    id: string,
    from: HousekeepingStatus,
    data: Prisma.HousekeepingTaskUncheckedUpdateInput,
  ): Promise<HousekeepingTaskWithRelations | null> {
    const { count } = await this.prisma.housekeepingTask.updateMany({
      where: { id, status: from },
      data,
    });

    return count === 0 ? null : this.findById(id);
  }
}
