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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsService } from './floors.service';
import { Floor } from '../../../generated/prisma/client';

@ApiTags('floors')
@Controller('villas/:villaId/floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Post()
  @RequirePermission('villas.write')
  @ApiOperation({ summary: 'Add a rentable floor to a villa (FR-104, FR-201–FR-203)' })
  create(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Body() dto: CreateFloorDto,
  ): Promise<Floor> {
    return this.floorsService.create(villaId, dto);
  }

  @Get()
  @RequirePermission('villas.read')
  @ApiOperation({ summary: 'List a villa’s floors' })
  findAll(@Param('villaId', ParseUUIDPipe) villaId: string): Promise<Floor[]> {
    return this.floorsService.findAllByVilla(villaId);
  }

  @Get(':id')
  @RequirePermission('villas.read')
  @ApiOperation({ summary: 'Get a single floor' })
  findOne(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Floor> {
    return this.floorsService.findOneOrThrow(villaId, id);
  }

  @Patch(':id')
  @RequirePermission('villas.write')
  @ApiOperation({ summary: 'Edit a floor (capacity, pricing, rentable status)' })
  update(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFloorDto,
  ): Promise<Floor> {
    return this.floorsService.update(villaId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('villas.write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a floor' })
  async remove(
    @Param('villaId', ParseUUIDPipe) villaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.floorsService.remove(villaId, id);
  }
}
