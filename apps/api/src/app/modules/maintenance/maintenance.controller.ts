import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { ListMaintenanceRecordsQueryDto } from './dto/list-maintenance-records-query.dto';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRecord, UserRole } from '../../../generated/prisma/client';

const MUTATE_ROLES = [UserRole.Administrator, UserRole.Operations] as const;

@ApiTags('maintenance-records')
@Controller('villas/:villaId/maintenance-records')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Log a maintenance record for a villa (FR-801, FR-802)' })
  create(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Body() dto: CreateMaintenanceRecordDto,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.create(villaId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List a villa's maintenance records (filterable by status/priority)" })
  findAll(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Query() query: ListMaintenanceRecordsQueryDto,
  ): Promise<MaintenanceRecord[]> {
    return this.maintenanceService.findAllByVilla(villaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single maintenance record' })
  findOne(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.findOneOrThrow(villaId, id);
  }

  @Post(':id/start')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Open -> InProgress' })
  start(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.start(villaId, id);
  }

  @Post(':id/complete')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'InProgress -> Completed (FR-803: history is preserved, not deleted)' })
  complete(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.complete(villaId, id);
  }
}
