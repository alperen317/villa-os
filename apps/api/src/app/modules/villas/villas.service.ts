import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVillaDto } from './dto/create-villa.dto';
import { ListVillasQueryDto } from './dto/list-villas-query.dto';
import { UpdateVillaDto } from './dto/update-villa.dto';
import { VillasRepository } from './villas.repository';
import { Villa, VillaStatus } from '../../../generated/prisma/client';

export interface VillaWithMaintenanceFlag extends Villa {
  hasOpenMaintenance: boolean;
}

@Injectable()
export class VillasService {
  constructor(private readonly villasRepository: VillasRepository) {}

  create(dto: CreateVillaDto): Promise<Villa> {
    return this.villasRepository.create(dto);
  }

  async findAll(
    query: ListVillasQueryDto,
  ): Promise<{ data: VillaWithMaintenanceFlag[]; total: number }> {
    const params = { skip: query.skip, take: query.limit, status: query.status, arrivingToday: query.arrivingToday };
    const [data, total] = await Promise.all([
      this.villasRepository.findMany(params),
      this.villasRepository.count(params),
    ]);

    const openMaintenanceVillaIds = await this.villasRepository.findVillaIdsWithOpenMaintenance(
      data.map((villa) => villa.id),
    );

    return {
      data: data.map((villa) => ({
        ...villa,
        hasOpenMaintenance: openMaintenanceVillaIds.has(villa.id),
      })),
      total,
    };
  }

  async findOneOrThrow(id: string): Promise<Villa> {
    const villa = await this.villasRepository.findById(id);
    if (!villa) {
      throw new NotFoundException(`Villa ${id} not found`);
    }

    return villa;
  }

  async update(id: string, dto: UpdateVillaDto): Promise<Villa> {
    await this.findOneOrThrow(id);
    return this.villasRepository.update(id, dto);
  }

  async setStatus(id: string, status: VillaStatus): Promise<Villa> {
    await this.findOneOrThrow(id);
    return this.villasRepository.update(id, { status });
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.villasRepository.softDelete(id);
  }
}
