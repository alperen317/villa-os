import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListCustomersQueryDto extends PaginationQueryDto {
  /** Matches against first name, last name, phone, or email. */
  @IsOptional()
  @IsString()
  search?: string;
}
