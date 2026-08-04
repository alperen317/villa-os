import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';
import { ReservationStatus, UserRole } from '../../../generated/prisma/client';
import { ReservationWithRelations } from './reservations.repository';

const MUTATE_ROLES = [UserRole.Administrator, UserRole.Operations] as const;

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Create a reservation (FR-301–FR-306, FR-401–FR-404)' })
  create(@Body() dto: CreateReservationDto): Promise<ReservationWithRelations> {
    return this.reservationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List reservations (paginated, filterable by villaId/customerId/status)' })
  async findAll(
    @Query() query: ListReservationsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservationWithRelations[]> {
    const { data, total } = await this.reservationsService.findAll(query);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single reservation' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.findOneOrThrow(id);
  }

  @Patch(':id')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Edit guest count / notes (dates and unit are immutable — cancel and rebook instead)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ): Promise<ReservationWithRelations> {
    return this.reservationsService.update(id, dto);
  }

  @Post(':id/confirm')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Pending -> Confirmed' })
  confirm(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.Confirmed);
  }

  @Post(':id/check-in')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Confirmed -> CheckedIn' })
  checkIn(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.CheckedIn);
  }

  @Post(':id/check-out')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'CheckedIn -> CheckedOut' })
  checkOut(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.CheckedOut);
  }

  @Post(':id/complete')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'CheckedOut -> Completed' })
  complete(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.Completed);
  }

  @Post(':id/cancel')
  @Roles(...MUTATE_ROLES)
  @ApiOperation({ summary: 'Pending/Confirmed -> Cancelled' })
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationWithRelations> {
    return this.reservationsService.transition(id, ReservationStatus.Cancelled);
  }
}
