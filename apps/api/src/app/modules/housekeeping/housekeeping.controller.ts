import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { ListHousekeepingTasksQueryDto } from './dto/list-housekeeping-tasks-query.dto';
import { HousekeepingTaskWithRelations } from './housekeeping.repository';
import { HousekeepingService } from './housekeeping.service';

@ApiTags('housekeeping-tasks')
@Controller('housekeeping-tasks')
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Post()
  @RequirePermission('housekeeping.write')
  @ApiOperation({ summary: 'Manually open an ad-hoc cleaning task for a villa (not tied to a reservation)' })
  create(@Body() dto: CreateHousekeepingTaskDto): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.createManual(dto);
  }

  @Get()
  @RequirePermission('housekeeping.read')
  @ApiOperation({ summary: 'List housekeeping tasks (filterable by villaId/status)' })
  findAll(@Query() query: ListHousekeepingTasksQueryDto): Promise<HousekeepingTaskWithRelations[]> {
    return this.housekeepingService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('housekeeping.read')
  @ApiOperation({ summary: 'Get a single housekeeping task' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.findOneOrThrow(id);
  }

  @Post(':id/start')
  @RequirePermission('housekeeping.write')
  @ApiOperation({ summary: 'Pending -> InProgress (self-assigns if unassigned)' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.start(id, user.sub);
  }

  @Post(':id/complete')
  @RequirePermission('housekeeping.write')
  @ApiOperation({ summary: 'InProgress -> Completed' })
  complete(@Param('id', ParseUUIDPipe) id: string): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.complete(id);
  }
}
