import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingRepository } from './housekeeping.repository';
import { HousekeepingService } from './housekeeping.service';

@Module({
  controllers: [HousekeepingController],
  providers: [HousekeepingService, HousekeepingRepository],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
