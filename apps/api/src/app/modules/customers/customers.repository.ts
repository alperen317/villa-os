import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Customer, Prisma } from '../../../generated/prisma/client';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerUncheckedCreateInput): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
  }

  findMany(params: { skip: number; take: number; search?: string }): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: this.buildWhere(params.search),
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(params: { search?: string }): Promise<number> {
    return this.prisma.customer.count({ where: this.buildWhere(params.search) });
  }

  update(id: string, data: Prisma.CustomerUncheckedUpdateInput): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private buildWhere(search?: string): Prisma.CustomerWhereInput {
    if (!search) {
      return { deletedAt: null };
    }

    return {
      deletedAt: null,
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }
}
