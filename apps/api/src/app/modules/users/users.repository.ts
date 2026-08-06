import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma, UserRole } from '../../../generated/prisma/client';

const SAFE_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserUncheckedCreateInput): Promise<SafeUser> {
    return this.prisma.user.create({ data, select: SAFE_USER_SELECT });
  }

  findMany(params: { skip: number; take: number }): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
      select: SAFE_USER_SELECT,
    });
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }

  findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  }

  async usernameExists(username: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    return user !== null;
  }

  update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<SafeUser> {
    return this.prisma.user.update({ where: { id }, data, select: SAFE_USER_SELECT });
  }

  setActive(id: string, isActive: boolean): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: SAFE_USER_SELECT,
    });
  }

  updatePassword(id: string, passwordHash: string): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: SAFE_USER_SELECT,
    });
  }

  countActiveByRole(role: UserRole): Promise<number> {
    return this.prisma.user.count({ where: { role, isActive: true } });
  }
}
