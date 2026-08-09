import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService, HealthReport } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Version-neutral on purpose: container healthchecks and uptime monitors
  // should not need updating when the API version moves on.
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health')
  @ApiOperation({ summary: 'Liveness and readiness of the API and its backing services' })
  @ApiResponse({ status: 200, description: 'API, database and Redis are all reachable' })
  @ApiResponse({ status: 503, description: 'At least one backing service is unreachable' })
  health(): Promise<HealthReport> {
    return this.appService.checkHealth();
  }
}
