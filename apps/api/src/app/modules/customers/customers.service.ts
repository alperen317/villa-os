import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersRepository } from './customers.repository';
import { Customer } from '../../../generated/prisma/client';
import { AppException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';

@Injectable()
export class CustomersService {
  constructor(private readonly customersRepository: CustomersRepository) {}

  create(dto: CreateCustomerDto): Promise<Customer> {
    return this.customersRepository.create(dto);
  }

  async findAll(query: ListCustomersQueryDto): Promise<{ data: Customer[]; total: number }> {
    const [data, total] = await Promise.all([
      this.customersRepository.findMany({
        skip: query.skip,
        take: query.limit,
        search: query.search,
      }),
      this.customersRepository.count({ search: query.search }),
    ]);

    return { data, total };
  }

  async findOneOrThrow(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findById(id);
    if (!customer) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.CUSTOMER_NOT_FOUND,
        `Customer ${id} not found`,
      );
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    await this.findOneOrThrow(id);
    return this.customersRepository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.customersRepository.softDelete(id);
  }
}
