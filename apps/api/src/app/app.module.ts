import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { VillasModule } from './modules/villas/villas.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { PermissionsModule } from './modules/permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Baseline ceiling for every route; the auth endpoints tighten it further.
    // Counters are per-process and in-memory, which is enough for the
    // single-container deployment this system targets.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    PermissionsModule,
    VillasModule,
    CustomersModule,
    ReservationsModule,
    PaymentsModule,
    HousekeepingModule,
    MaintenanceModule,
    DashboardModule,
    ReportingModule,
    SettingsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
