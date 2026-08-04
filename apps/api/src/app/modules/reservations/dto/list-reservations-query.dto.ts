import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ReservationStatus } from '../../../../generated/prisma/client';

export class ListReservationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  villaId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
