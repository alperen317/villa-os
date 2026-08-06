import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { ListAllMaintenanceRecordsQueryDto } from './dto/list-all-maintenance-records-query.dto';
import { MaintenanceRecordWithVilla } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance-records')
@Controller('maintenance-records')
export class MaintenanceRecordsController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @RequirePermission('maintenance.read')
  @ApiOperation({ summary: 'List maintenance records across all villas (paginated, filterable by villaId/status/priority)' })
  async findAll(
    @Query() query: ListAllMaintenanceRecordsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MaintenanceRecordWithVilla[]> {
    const { data, total } = await this.maintenanceService.findAll(query);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }
}
