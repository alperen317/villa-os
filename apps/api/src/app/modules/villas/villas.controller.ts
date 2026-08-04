import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateVillaDto } from './dto/create-villa.dto';
import { ListVillasQueryDto } from './dto/list-villas-query.dto';
import { UpdateVillaDto } from './dto/update-villa.dto';
import { VillasService, VillaWithMaintenanceFlag } from './villas.service';
import { UserRole, Villa, VillaStatus } from '../../../generated/prisma/client';

@ApiTags('villas')
@Controller('villas')
export class VillasController {
  constructor(private readonly villasService: VillasService) {}

  @Post()
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Create a villa (FR-101)' })
  create(@Body() dto: CreateVillaDto): Promise<Villa> {
    return this.villasService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List villas (paginated)' })
  async findAll(
    @Query() query: ListVillasQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VillaWithMaintenanceFlag[]> {
    const { data, total } = await this.villasService.findAll(query, query.status);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single villa' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Villa> {
    return this.villasService.findOneOrThrow(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Edit villa information (FR-102)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVillaDto): Promise<Villa> {
    return this.villasService.update(id, dto);
  }

  @Post(':id/activate')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Activate a villa (FR-103)' })
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<Villa> {
    return this.villasService.setStatus(id, VillaStatus.Active);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.Administrator)
  @ApiOperation({ summary: 'Deactivate a villa (FR-103)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<Villa> {
    return this.villasService.setStatus(id, VillaStatus.Inactive);
  }

  @Delete(':id')
  @Roles(UserRole.Administrator)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a villa' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.villasService.remove(id);
  }
}
