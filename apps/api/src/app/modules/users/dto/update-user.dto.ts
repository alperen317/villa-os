import { IsEnum } from 'class-validator';
import { UserRole } from '../../../../generated/prisma/client';

export class UpdateUserDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
