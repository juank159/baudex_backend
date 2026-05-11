import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PermissionModuleCode } from '../entities/user-module-permission.entity';

export class ModulePermissionDto {
  @IsEnum(PermissionModuleCode, {
    message: 'Módulo inválido',
  })
  moduleCode: PermissionModuleCode;

  @IsBoolean()
  canView: boolean;

  @IsBoolean()
  canEdit: boolean;

  @IsBoolean()
  canDelete: boolean;
}

export class SetPermissionsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Se requiere al menos un módulo' })
  @ValidateNested({ each: true })
  @Type(() => ModulePermissionDto)
  permissions: ModulePermissionDto[];
}
