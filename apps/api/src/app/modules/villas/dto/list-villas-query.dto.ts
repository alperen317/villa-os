import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { VillaStatus } from '../../../../generated/prisma/client';

export class ListVillasQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(VillaStatus)
  status?: VillaStatus;
}
