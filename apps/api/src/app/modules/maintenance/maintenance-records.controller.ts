import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListAllMaintenanceRecordsQueryDto } from './dto/list-all-maintenance-records-query.dto';
import { MaintenanceRecordWithVilla } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance-records')
@Controller('maintenance-records')
export class MaintenanceRecordsController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'List maintenance records across all villas (filterable by villaId/status/priority)' })
  findAll(@Query() query: ListAllMaintenanceRecordsQueryDto): Promise<MaintenanceRecordWithVilla[]> {
    return this.maintenanceService.findAll(query);
  }
}
