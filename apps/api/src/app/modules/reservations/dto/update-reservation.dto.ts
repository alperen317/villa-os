import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateReservationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * updatedAt the client last read before editing. If it no longer matches the
   * stored record, someone else changed it in between — reject as a conflict
   * instead of silently overwriting (needed for offline-queued edits).
   */
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
