import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { ListHousekeepingTasksQueryDto } from './dto/list-housekeeping-tasks-query.dto';
import { HousekeepingTaskWithRelations } from './housekeeping.repository';
import { HousekeepingService } from './housekeeping.service';
import { UserRole } from '../../../generated/prisma/client';

const MUTATE_ROLES = [UserRole.Administrator, UserRole.Housekeeping] as const;

@ApiTags('housekeeping-tasks')
@Controller('housekeeping-tasks')
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Post()
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Manually open an ad-hoc cleaning task for a villa (not tied to a reservation)' })
  create(@Body() dto: CreateHousekeepingTaskDto): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.createManual(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List housekeeping tasks (filterable by villaId/status)' })
  findAll(@Query() query: ListHousekeepingTasksQueryDto): Promise<HousekeepingTaskWithRelations[]> {
    return this.housekeepingService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single housekeeping task' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.findOneOrThrow(id);
  }

  @Post(':id/start')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Pending -> InProgress (self-assigns if unassigned)' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.start(id, user.sub);
  }

  @Post(':id/complete')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'InProgress -> Completed' })
  complete(@Param('id', ParseUUIDPipe) id: string): Promise<HousekeepingTaskWithRelations> {
    return this.housekeepingService.complete(id);
  }
}
