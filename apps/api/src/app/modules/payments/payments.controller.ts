import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService, PaymentsSummary } from './payments.service';
import { Payment } from '../../../generated/prisma/client';

@ApiTags('payments')
@Controller('reservations/:reservationId/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequirePermission('payments.write')
  @ApiOperation({ summary: 'Record a payment against a reservation (FR-601, FR-603)' })
  create(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: CreatePaymentDto,
  ): Promise<Payment> {
    return this.paymentsService.create(reservationId, dto);
  }

  @Get()
  @RequirePermission('payments.read')
  @ApiOperation({ summary: 'List payments and outstanding balance for a reservation (FR-602)' })
  findAll(@Param('reservationId', ParseUUIDPipe) reservationId: string): Promise<PaymentsSummary> {
    return this.paymentsService.findSummaryByReservation(reservationId);
  }
}
