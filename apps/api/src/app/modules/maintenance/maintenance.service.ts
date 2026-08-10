import { HttpStatus, Injectable } from '@nestjs/common';
import { VillasService } from '../villas/villas.service';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { ListAllMaintenanceRecordsQueryDto } from './dto/list-all-maintenance-records-query.dto';
import { ListMaintenanceRecordsQueryDto } from './dto/list-maintenance-records-query.dto';
import { InvalidMaintenanceTransitionException } from './exceptions/invalid-maintenance-transition.exception';
import { MaintenanceRepository, MaintenanceRecordWithVilla } from './maintenance.repository';
import { MaintenanceRecord, MaintenanceStatus, Prisma } from '../../../generated/prisma/client';
import { AppException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';

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

  async findAll(
    query: ListAllMaintenanceRecordsQueryDto,
  ): Promise<{ data: MaintenanceRecordWithVilla[]; total: number }> {
    const params = {
      skip: query.skip,
      take: query.limit,
      villaId: query.villaId,
      status: query.status,
      priority: query.priority,
    };
    const [data, total] = await Promise.all([
      this.maintenanceRepository.findMany(params),
      this.maintenanceRepository.count(params),
    ]);

    return { data, total };
  }

  /**
   * Looks a record up without knowing its villa — which is the position anything holding
   * only a `maintenanceRecordId` is in, such as an expense linking back to the job.
   */
  async findByIdOrThrow(id: string): Promise<MaintenanceRecord> {
    const record = await this.maintenanceRepository.findById(id);
    if (!record) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.MAINTENANCE_RECORD_NOT_FOUND,
        `Maintenance record ${id} not found`,
      );
    }

    return record;
  }

  async findOneOrThrow(villaId: string, id: string): Promise<MaintenanceRecord> {
    const record = await this.maintenanceRepository.findById(id);
    if (!record || record.villaId !== villaId) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.MAINTENANCE_RECORD_NOT_FOUND,
        `Maintenance record ${id} not found for villa ${villaId}`,
      );
    }

    return record;
  }

  /**
   * The status is read here and written a statement later, and two people working the same
   * villa's record list can both land in that gap. Carrying the expected status into the
   * WHERE lets the database settle it: the second request matches no row and is told the
   * record already moved, instead of overwriting completedAt with its own timestamp.
   */
  async start(villaId: string, id: string): Promise<MaintenanceRecord> {
    const record = await this.findOneOrThrow(villaId, id);

    if (record.status !== MaintenanceStatus.Open) {
      throw new InvalidMaintenanceTransitionException(record.status, MaintenanceStatus.InProgress);
    }

    return this.applyTransition(villaId, id, MaintenanceStatus.Open, MaintenanceStatus.InProgress, {
      status: MaintenanceStatus.InProgress,
    });
  }

  async complete(villaId: string, id: string): Promise<MaintenanceRecord> {
    const record = await this.findOneOrThrow(villaId, id);

    if (record.status !== MaintenanceStatus.InProgress) {
      throw new InvalidMaintenanceTransitionException(record.status, MaintenanceStatus.Completed);
    }

    return this.applyTransition(
      villaId,
      id,
      MaintenanceStatus.InProgress,
      MaintenanceStatus.Completed,
      { status: MaintenanceStatus.Completed, completedAt: new Date() },
    );
  }

  private async applyTransition(
    villaId: string,
    id: string,
    from: MaintenanceStatus,
    to: MaintenanceStatus,
    data: Prisma.MaintenanceRecordUncheckedUpdateInput,
  ): Promise<MaintenanceRecord> {
    const updated = await this.maintenanceRepository.updateFromStatus(id, from, data);

    if (!updated) {
      // Report the status it actually holds now, not the one this request read.
      const current = await this.findOneOrThrow(villaId, id);
      throw new InvalidMaintenanceTransitionException(current.status, to);
    }

    return updated;
  }
}
