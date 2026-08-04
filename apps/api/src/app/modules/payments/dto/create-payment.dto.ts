import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';
import { PaymentMethod } from '../../../../generated/prisma/client';

export class CreatePaymentDto {
  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
