import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { FloorWithVilla } from '../villas/floors.repository';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';
import { ReservationStatus } from '../../../generated/prisma/client';
import { ReservationWithRelations } from './reservations.repository';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @RequirePermission('reservations.write')
  @ApiOperation({ summary: 'Create a reservation (FR-301–FR-306, FR-401–FR-404)' })
  create(
    @Body() dto: CreateReservationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ReservationWithRelations> {
    return this.reservationsService.create(dto, idempotencyKey);
  }

  @Get()
  @RequirePermission('reservations.read')
  @ApiOperation({ summary: 'List reservations (paginated, filterable by villaId/customerId/status)' })
  async findAll(
    @Query() query: ListReservationsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservationWithRelations[]> {
    const { data, total } = await this.reservationsService.findAll(query);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Get('availability')
  @RequirePermission('reservations.read')
  @ApiOperation({
    summary: 'List rentable floors with no conflicting reservation for a date range',
  })
  findAvailability(@Query() query: AvailabilityQueryDto): Promise<FloorWithVilla[]> {
    return this.reservationsService.findAvailableFloors(query);
  }

  @Get(':id')
  @RequirePermission('reservations.read')
  @ApiOperation({ summary: 'Get a single reservation' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.findOneOrThrow(id);
  }

  @Patch(':id')
  @RequirePermission('reservations.write')
  @ApiOperation({ summary: 'Edit guest count / notes (dates and unit are immutable — cancel and rebook instead)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ): Promise<ReservationWithRelations> {
    return this.reservationsService.update(id, dto);
  }

  @Post(':id/confirm')
  @RequirePermission('reservations.write')
  @ApiOperation({ summary: 'Pending -> Confirmed' })
  confirm(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.Confirmed);
  }

  @Post(':id/check-in')
  @RequirePermission('reservations.write')
  @ApiOperation({ summary: 'Confirmed -> CheckedIn' })
  checkIn(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.CheckedIn);
  }

  @Post(':id/check-out')
  @RequirePermission('reservations.write')
  @ApiOperation({ summary: 'CheckedIn -> CheckedOut' })
  checkOut(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.CheckedOut);
  }

  @Post(':id/complete')
  @RequirePermission('reservations.write')
  @ApiOperation({ summary: 'CheckedOut -> Completed' })
  complete(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.Completed);
  }

  @Post(':id/cancel')
  @RequirePermission('reservations.write')
  @ApiOperation({ summary: 'Pending/Confirmed -> Cancelled' })
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.Cancelled);
  }

  @Delete(':id')
  @RequirePermission('reservations.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a reservation entered by mistake (use cancel otherwise)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.reservationsService.remove(id);
  }
}
