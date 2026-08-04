import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsRepository, FloorWithVilla } from './floors.repository';
import { VillasService } from './villas.service';
import { Floor } from '../../../generated/prisma/client';

@Injectable()
export class FloorsService {
  constructor(
    private readonly floorsRepository: FloorsRepository,
    private readonly villasService: VillasService,
  ) {}

  async create(villaId: string, dto: CreateFloorDto): Promise<Floor> {
    await this.villasService.findOneOrThrow(villaId);

    if (dto.isEntireVilla) {
      await this.assertNoExistingEntireVillaFloor(villaId);
    }

    return this.floorsRepository.create({ ...dto, villaId });
  }

  async findAllByVilla(villaId: string): Promise<Floor[]> {
    await this.villasService.findOneOrThrow(villaId);
    return this.floorsRepository.findManyByVilla(villaId);
  }

  findRentableFloors(villaId?: string): Promise<FloorWithVilla[]> {
    return this.floorsRepository.findRentable(villaId);
  }

  async findOneOrThrow(villaId: string, id: string): Promise<Floor> {
    const floor = await this.floorsRepository.findById(id);
    if (!floor || floor.villaId !== villaId) {
      throw new NotFoundException(`Floor ${id} not found for villa ${villaId}`);
    }

    return floor;
  }

  async update(villaId: string, id: string, dto: UpdateFloorDto): Promise<Floor> {
    const floor = await this.findOneOrThrow(villaId, id);

    if (dto.isEntireVilla && !floor.isEntireVilla) {
      await this.assertNoExistingEntireVillaFloor(villaId);
    }

    return this.floorsRepository.update(id, dto);
  }

  async remove(villaId: string, id: string): Promise<void> {
    await this.findOneOrThrow(villaId, id);
    await this.floorsRepository.softDelete(id);
  }

  private async assertNoExistingEntireVillaFloor(villaId: string): Promise<void> {
    const existing = await this.floorsRepository.findEntireVillaFloor(villaId);
    if (existing) {
      throw new ConflictException(`Villa ${villaId} already has an entire-villa floor`);
    }
  }
}
