import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Floor, Prisma } from '../../../generated/prisma/client';

const FLOOR_WITH_VILLA_INCLUDE = {
  villa: { select: { id: true, name: true } },
} satisfies Prisma.FloorInclude;

export type FloorWithVilla = Prisma.FloorGetPayload<{ include: typeof FLOOR_WITH_VILLA_INCLUDE }>;

@Injectable()
export class FloorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.FloorUncheckedCreateInput): Promise<Floor> {
    return this.prisma.floor.create({ data });
  }

  findById(id: string): Promise<Floor | null> {
    return this.prisma.floor.findFirst({ where: { id, deletedAt: null } });
  }

  findManyByVilla(villaId: string): Promise<Floor[]> {
    return this.prisma.floor.findMany({
      where: { villaId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  findRentable(villaId?: string): Promise<FloorWithVilla[]> {
    return this.prisma.floor.findMany({
      where: {
        deletedAt: null,
        rentable: true,
        villaId,
        villa: { deletedAt: null, status: 'Active' },
      },
      include: FLOOR_WITH_VILLA_INCLUDE,
      orderBy: [{ villaId: 'asc' }, { isEntireVilla: 'desc' }],
    });
  }

  findEntireVillaFloor(villaId: string): Promise<Floor | null> {
    return this.prisma.floor.findFirst({
      where: { villaId, isEntireVilla: true, deletedAt: null },
    });
  }

  update(id: string, data: Prisma.FloorUncheckedUpdateInput): Promise<Floor> {
    return this.prisma.floor.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Floor> {
    return this.prisma.floor.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
