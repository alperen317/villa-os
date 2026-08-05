import { Injectable, NotFoundException } from '@nestjs/common';
import { VillasService } from '../villas/villas.service';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { ListAllMaintenanceRecordsQueryDto } from './dto/list-all-maintenance-records-query.dto';
import { ListMaintenanceRecordsQueryDto } from './dto/list-maintenance-records-query.dto';
import { InvalidMaintenanceTransitionException } from './exceptions/invalid-maintenance-transition.exception';
import { MaintenanceRepository, MaintenanceRecordWithVilla } from './maintenance.repository';
import { MaintenanceRecord, MaintenanceStatus } from '../../../generated/prisma/client';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly maintenanceRepository: MaintenanceRepository,
    private readonly villasService: VillasService,
  ) {}

  async create(villaId: string, dto: CreateMaintenanceRecordDto): Promise<MaintenanceRecord> {
    await this.villasService.findOneOrThrow(villaId);

    return this.maintenanceRepository.create({
      villaId,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      openedAt: dto.openedAt ? new Date(dto.openedAt) : undefined,
    });
  }

  async findAllByVilla(
    villaId: string,
    query: ListMaintenanceRecordsQueryDto,
  ): Promise<MaintenanceRecord[]> {
    await this.villasService.findOneOrThrow(villaId);
    return this.maintenanceRepository.findManyByVilla({
      villaId,
      status: query.status,
      priority: query.priority,
    });
  }

  findAll(query: ListAllMaintenanceRecordsQueryDto): Promise<MaintenanceRecordWithVilla[]> {
    return this.maintenanceRepository.findMany({
      villaId: query.villaId,
      status: query.status,
      priority: query.priority,
    });
  }

  async findOneOrThrow(villaId: string, id: string): Promise<MaintenanceRecord> {
    const record = await this.maintenanceRepository.findById(id);
    if (!record || record.villaId !== villaId) {
      throw new NotFoundException(`Maintenance record ${id} not found for villa ${villaId}`);
    }

    return record;
  }

  async start(villaId: string, id: string): Promise<MaintenanceRecord> {
    const record = await this.findOneOrThrow(villaId, id);

    if (record.status !== MaintenanceStatus.Open) {
      throw new InvalidMaintenanceTransitionException(record.status, MaintenanceStatus.InProgress);
    }

    return this.maintenanceRepository.update(id, { status: MaintenanceStatus.InProgress });
  }

  async complete(villaId: string, id: string): Promise<MaintenanceRecord> {
    const record = await this.findOneOrThrow(villaId, id);

    if (record.status !== MaintenanceStatus.InProgress) {
      throw new InvalidMaintenanceTransitionException(record.status, MaintenanceStatus.Completed);
    }

    return this.maintenanceRepository.update(id, {
      status: MaintenanceStatus.Completed,
      completedAt: new Date(),
    });
  }
}
