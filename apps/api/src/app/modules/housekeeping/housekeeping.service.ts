import { Injectable, NotFoundException } from '@nestjs/common';
import { VillasService } from '../villas/villas.service';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { InvalidHousekeepingTransitionException } from './exceptions/invalid-housekeeping-transition.exception';
import { HousekeepingRepository, HousekeepingTaskWithRelations } from './housekeeping.repository';
import { ListHousekeepingTasksQueryDto } from './dto/list-housekeeping-tasks-query.dto';
import { HousekeepingStatus } from '../../../generated/prisma/client';

@Injectable()
export class HousekeepingService {
  constructor(
    private readonly housekeepingRepository: HousekeepingRepository,
    private readonly villasService: VillasService,
  ) {}

  createForReservation(reservationId: string, villaId: string): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingRepository.create({ reservationId, villaId });
  }

  async createManual(dto: CreateHousekeepingTaskDto): Promise<HousekeepingTaskWithRelations> {
    await this.villasService.findOneOrThrow(dto.villaId);
    return this.housekeepingRepository.create({ villaId: dto.villaId, notes: dto.notes });
  }

  findAll(query: ListHousekeepingTasksQueryDto): Promise<HousekeepingTaskWithRelations[]> {
    return this.housekeepingRepository.findMany({ villaId: query.villaId, status: query.status });
  }

  async findOneOrThrow(id: string): Promise<HousekeepingTaskWithRelations> {
    const task = await this.housekeepingRepository.findById(id);
    if (!task) {
      throw new NotFoundException(`Housekeeping task ${id} not found`);
    }

    return task;
  }

  async start(id: string, currentUserId: string): Promise<HousekeepingTaskWithRelations> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== HousekeepingStatus.Pending) {
      throw new InvalidHousekeepingTransitionException(task.status, HousekeepingStatus.InProgress);
    }

    return this.housekeepingRepository.update(id, {
      status: HousekeepingStatus.InProgress,
      startedAt: new Date(),
      assignedUserId: task.assignedUserId ?? currentUserId,
    });
  }

  async complete(id: string): Promise<HousekeepingTaskWithRelations> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== HousekeepingStatus.InProgress) {
      throw new InvalidHousekeepingTransitionException(task.status, HousekeepingStatus.Completed);
    }

    return this.housekeepingRepository.update(id, {
      status: HousekeepingStatus.Completed,
      completedAt: new Date(),
    });
  }
}
