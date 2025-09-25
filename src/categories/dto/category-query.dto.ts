import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryStatus } from '../entities/category.entity';

export enum CategorySortFields {
  NAME = 'name',
  SLUG = 'slug',
  DESCRIPTION = 'description',
  SORT_ORDER = 'sortOrder',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export class CategoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La página debe ser un número' })
  @Min(1, { message: 'La página debe ser mayor a 0' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  @Max(100, { message: 'El límite no puede ser mayor a 100' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  search?: string;

  @IsOptional()
  @IsEnum(CategoryStatus, {
    message: 'El estado debe ser active o inactive',
  })
  status?: CategoryStatus;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del padre debe ser un UUID válido' })
  parentId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'onlyParents debe ser un valor booleano' })
  onlyParents?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'includeChildren debe ser un valor booleano' })
  includeChildren?: boolean;

  @IsOptional()
  @IsEnum(CategorySortFields, {
    message: 'El campo de ordenamiento no es válido',
  })
  sortBy?: CategorySortFields = CategorySortFields.SORT_ORDER;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'ASC';

  // ==================== FILTROS ADICIONALES ====================

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El nivel debe ser un número' })
  @Min(0, { message: 'El nivel debe ser mayor o igual a 0' })
  @Max(5, { message: 'El nivel no puede ser mayor a 5' })
  level?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'withProductCount debe ser un valor booleano' })
  withProductCount?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'onlyWithProducts debe ser un valor booleano' })
  onlyWithProducts?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'onlyWithoutProducts debe ser un valor booleano' })
  onlyWithoutProducts?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'createdAfter debe ser una fecha válida' })
  createdAfter?: string;

  @IsOptional()
  @IsDateString({}, { message: 'createdBefore debe ser una fecha válida' })
  createdBefore?: string;
}
