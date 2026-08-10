import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import {
  CustomersReport,
  ExpensesReport,
  OccupancyReport,
  ReportingService,
  ReservationsReport,
  RevenueReport,
} from './reporting.service';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('occupancy')
  @RequirePermission('reports.read')
  @ApiOperation({ summary: 'Occupancy report for a date range (FR-1001)' })
  getOccupancy(@Query() query: ReportQueryDto): Promise<OccupancyReport> {
    return this.reportingService.getOccupancyReport(query);
  }

  @Get('revenue')
  @RequirePermission('reports.read')
  @ApiOperation({ summary: 'Revenue report for a date range (FR-1002)' })
  getRevenue(@Query() query: ReportQueryDto): Promise<RevenueReport> {
    return this.reportingService.getRevenueReport(query);
  }

  @Get('expenses')
  @RequirePermission('reports.read')
  @ApiOperation({ summary: 'Expense report for a date range (FR-1005)' })
  getExpenses(@Query() query: ReportQueryDto): Promise<ExpensesReport> {
    return this.reportingService.getExpensesReport(query);
  }

  @Get('reservations')
  @RequirePermission('reports.read')
  @ApiOperation({ summary: 'Reservation report for a date range (FR-1003)' })
  getReservations(@Query() query: ReportQueryDto): Promise<ReservationsReport> {
    return this.reportingService.getReservationsReport(query);
  }

  @Get('customers')
  @RequirePermission('reports.read')
  @ApiOperation({ summary: 'Customer report for a date range (FR-1004)' })
  getCustomers(@Query() query: ReportQueryDto): Promise<CustomersReport> {
    return this.reportingService.getCustomersReport(query);
  }
}
