import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateVillaDto } from './dto/create-villa.dto';
import { UpdateVillaDto } from './dto/update-villa.dto';
import { VillasRepository } from './villas.repository';
import { Villa, VillaStatus } from '../../../generated/prisma/client';

@Injectable()
export class VillasService {
  constructor(private readonly villasRepository: VillasRepository) {}

  create(dto: CreateVillaDto): Promise<Villa> {
    return this.villasRepository.create(dto);
  }

  async findAll(
    pagination: PaginationQueryDto,
    status?: VillaStatus,
  ): Promise<{ data: Villa[]; total: number }> {
    const [data, total] = await Promise.all([
      this.villasRepository.findMany({ skip: pagination.skip, take: pagination.limit, status }),
      this.villasRepository.count({ status }),
    ]);

    return { data, total };
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
