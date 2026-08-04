import { Module } from '@nestjs/common';
import { FloorsController } from './floors.controller';
import { FloorsRepository } from './floors.repository';
import { FloorsService } from './floors.service';
import { VillasController } from './villas.controller';
import { VillasRepository } from './villas.repository';
import { VillasService } from './villas.service';

@Module({
  controllers: [VillasController, FloorsController],
  providers: [VillasService, VillasRepository, FloorsService, FloorsRepository],
  exports: [VillasService, FloorsService],
})
export class VillasModule {}
