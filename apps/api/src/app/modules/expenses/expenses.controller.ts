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
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';
import { ExpenseWithRelations } from './expenses.repository';

@ApiTags('expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @RequirePermission('expenses.write')
  @ApiOperation({ summary: 'Record an expense (FR-1101, FR-1102)' })
  create(@Body() dto: CreateExpenseDto): Promise<ExpenseWithRelations> {
    return this.expensesService.create(dto);
  }

  @Get()
  @RequirePermission('expenses.read')
  @ApiOperation({
    summary:
      'List expenses (paginated; filter by ?villaId, ?category, ?dateFrom, ?dateTo, ?search). ' +
      'X-Total-Amount carries the sum over the whole filter, not the returned page.',
  })
  async findAll(
    @Query() query: ListExpensesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ExpenseWithRelations[]> {
    const { data, total, totalAmount } = await this.expensesService.findAll(query);
    res.setHeader('X-Total-Count', String(total));
    res.setHeader('X-Total-Amount', String(totalAmount));
    return data;
  }

  @Get(':id')
  @RequirePermission('expenses.read')
  @ApiOperation({ summary: 'Get a single expense' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ExpenseWithRelations> {
    return this.expensesService.findOneOrThrow(id);
  }

  @Patch(':id')
  @RequirePermission('expenses.write')
  @ApiOperation({ summary: 'Edit an expense (FR-1104)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseWithRelations> {
    return this.expensesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('expenses.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an expense (FR-1104)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.expensesService.remove(id);
  }
}
