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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';
import { Customer, UserRole } from '../../../generated/prisma/client';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.Administrator, UserRole.Operations)
  @ApiOperation({ summary: 'Create a customer profile (FR-501)' })
  create(@Body() dto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List customers (paginated, optionally filtered by ?search=)' })
  async findAll(
    @Query() query: ListCustomersQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Customer[]> {
    const { data, total } = await this.customersService.findAll(query);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single customer' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Customer> {
    return this.customersService.findOneOrThrow(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator, UserRole.Operations)
  @ApiOperation({ summary: 'Edit a customer profile' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.Administrator)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a customer' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.customersService.remove(id);
  }
}
