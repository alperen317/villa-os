import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MaintenancePriority, MaintenanceStatus } from '../../../../generated/prisma/client';

export class ListAllMaintenanceRecordsQueryDto {
  @IsOptional()
  @IsUUID()
  villaId?: string;

  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;
}
