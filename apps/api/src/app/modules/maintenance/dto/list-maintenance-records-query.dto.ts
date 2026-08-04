import { IsEnum, IsOptional } from 'class-validator';
import { MaintenancePriority, MaintenanceStatus } from '../../../../generated/prisma/client';

export class ListMaintenanceRecordsQueryDto {
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;
}
