import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { ListMaintenanceRecordsQueryDto } from './dto/list-maintenance-records-query.dto';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRecord } from '../../../generated/prisma/client';

@ApiTags('maintenance-records')
@Controller('villas/:villaId/maintenance-records')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @RequirePermission('maintenance.write')
  @ApiOperation({ summary: 'Log a maintenance record for a villa (FR-801, FR-802)' })
  create(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Body() dto: CreateMaintenanceRecordDto,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.create(villaId, dto);
  }

  @Get()
  @RequirePermission('maintenance.read')
  @ApiOperation({ summary: "List a villa's maintenance records (filterable by status/priority)" })
  findAll(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Query() query: ListMaintenanceRecordsQueryDto,
  ): Promise<MaintenanceRecord[]> {
    return this.maintenanceService.findAllByVilla(villaId, query);
  }

  @Get(':id')
  @RequirePermission('maintenance.read')
  @ApiOperation({ summary: 'Get a single maintenance record' })
  findOne(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.findOneOrThrow(villaId, id);
  }

  @Post(':id/start')
  @RequirePermission('maintenance.write')
  @ApiOperation({ summary: 'Open -> InProgress' })
  start(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.start(villaId, id);
  }

  @Post(':id/complete')
  @RequirePermission('maintenance.write')
  @ApiOperation({ summary: 'InProgress -> Completed (FR-803: history is preserved, not deleted)' })
  complete(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceService.complete(villaId, id);
  }
}
