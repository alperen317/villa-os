import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { HousekeepingStatus } from '../../../../generated/prisma/client';

export class ListHousekeepingTasksQueryDto {
  @IsOptional()
  @IsUUID()
  villaId?: string;

  @IsOptional()
  @IsEnum(HousekeepingStatus)
  status?: HousekeepingStatus;
}
