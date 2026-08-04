import { PartialType } from '@nestjs/mapped-types';
import { CreateVillaDto } from './create-villa.dto';

export class UpdateVillaDto extends PartialType(CreateVillaDto) {}
