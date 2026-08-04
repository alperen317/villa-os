import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  villaId!: string;

  @IsUUID()
  floorId!: string;

  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
