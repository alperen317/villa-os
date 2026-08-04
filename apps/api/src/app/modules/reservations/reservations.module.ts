import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { VillasModule } from '../villas/villas.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsRepository } from './reservations.repository';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [VillasModule, CustomersModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsRepository],
  exports: [ReservationsService],
})
export class ReservationsModule {}
