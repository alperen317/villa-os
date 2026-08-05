import { Module } from '@nestjs/common';
import { VillasModule } from '../villas/villas.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceRecordsController } from './maintenance-records.controller';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [VillasModule],
  controllers: [MaintenanceController, MaintenanceRecordsController],
  providers: [MaintenanceService, MaintenanceRepository],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
