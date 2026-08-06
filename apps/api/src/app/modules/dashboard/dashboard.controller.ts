import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { DashboardService, DashboardSummary } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermission('dashboard.read')
  @ApiOperation({ summary: 'Operational summary for the dashboard (FR-901)' })
  getSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary();
  }
}
