import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from './decorators/admin-only.decorator';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { PermissionRow, PermissionsService } from './permissions.service';

@ApiTags('permissions')
@Controller('permissions')
@AdminOnly()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the role permission matrix' })
  getMatrix(): Promise<PermissionRow[]> {
    return this.permissionsService.getMatrix();
  }

  @Patch()
  @ApiOperation({ summary: 'Update the role permission matrix' })
  updateMatrix(@Body() dto: UpdatePermissionsDto): Promise<PermissionRow[]> {
    return this.permissionsService.updateMatrix(dto.updates);
  }
}
