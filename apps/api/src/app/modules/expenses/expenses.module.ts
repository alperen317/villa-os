import { Module } from '@nestjs/common';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { VillasModule } from '../villas/villas.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [VillasModule, MaintenanceModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesRepository],
  exports: [ExpensesService],
})
export class ExpensesModule {}
