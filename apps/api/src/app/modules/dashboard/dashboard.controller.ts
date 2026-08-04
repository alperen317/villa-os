import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService, DashboardSummary } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Operational summary for the dashboard (FR-901)' })
  getSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary();
  }
}
