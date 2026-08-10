import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ExpenseCategory } from '../../../../generated/prisma/client';

export class ListExpensesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  villaId?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  /** Inclusive lower bound on `expenseDate`. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Inclusive upper bound on `expenseDate`. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Matches against description or supplier. */
  @IsOptional()
  @IsString()
  search?: string;
}
