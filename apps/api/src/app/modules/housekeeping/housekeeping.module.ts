import { Module } from '@nestjs/common';
import { VillasModule } from '../villas/villas.module';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingRepository } from './housekeeping.repository';
import { HousekeepingService } from './housekeeping.service';

@Module({
  imports: [VillasModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService, HousekeepingRepository],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
