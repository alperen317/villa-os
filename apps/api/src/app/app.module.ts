import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { VillasModule } from './modules/villas/villas.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    VillasModule,
    CustomersModule,
    ReservationsModule,
    PaymentsModule,
    HousekeepingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
