import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SafeUser, UsersRepository } from './users.repository';
import { UserRole } from '../../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const usernameTaken = await this.usersRepository.usernameExists(dto.username);
    if (usernameTaken) {
      throw new ConflictException('Bu kullanıcı adı zaten kullanılıyor');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.usersRepository.create({
      username: dto.username,
      passwordHash,
      role: dto.role,
      isActive: true,
    });
  }

  async findAll(query: ListUsersQueryDto): Promise<{ data: SafeUser[]; total: number }> {
    const [data, total] = await Promise.all([
      this.usersRepository.findMany({ skip: query.skip, take: query.limit }),
      this.usersRepository.count(),
    ]);

    return { data, total };
  }

  async findOneOrThrow(id: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.findOneOrThrow(id);
    return this.usersRepository.update(id, { role: dto.role });
  }

  async setActive(id: string, isActive: boolean, currentUserId: string): Promise<SafeUser> {
    const user = await this.findOneOrThrow(id);

    if (!isActive) {
      if (id === currentUserId) {
        throw new ForbiddenException('Kendi hesabınızı deaktif edemezsiniz');
      }

      if (user.role === UserRole.Administrator) {
        const activeAdminCount = await this.usersRepository.countActiveByRole(
          UserRole.Administrator,
        );
        if (activeAdminCount <= 1) {
          throw new ConflictException('Son aktif yönetici deaktif edilemez');
        }
      }
    }

    return this.usersRepository.setActive(id, isActive);
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<SafeUser> {
    await this.findOneOrThrow(id);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.usersRepository.updatePassword(id, passwordHash);
  }
}
