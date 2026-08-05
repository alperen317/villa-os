import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHousekeepingTaskDto {
  @IsUUID()
  villaId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
