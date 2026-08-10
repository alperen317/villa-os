import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { ExpenseCategory } from '../../../../generated/prisma/client';

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @Type(() => Number)
  @IsPositive()
  amount!: number;

  /** The date on the invoice, which is rarely the day it gets typed in. */
  @IsDateString()
  expenseDate!: string;

  /** Omit for a cost that belongs to the business rather than to one property. */
  @IsOptional()
  @IsUUID()
  villaId?: string;

  @IsOptional()
  @IsUUID()
  maintenanceRecordId?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
