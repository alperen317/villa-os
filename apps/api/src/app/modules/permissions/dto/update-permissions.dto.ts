import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { CONFIGURABLE_ROLES } from '../permission-catalog';

export class UpdatePermissionEntryDto {
  @IsIn(CONFIGURABLE_ROLES)
  role!: string;

  @IsString()
  @IsNotEmpty()
  permissionKey!: string;

  @IsBoolean()
  allowed!: boolean;
}

export class UpdatePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePermissionEntryDto)
  updates!: UpdatePermissionEntryDto[];
}
