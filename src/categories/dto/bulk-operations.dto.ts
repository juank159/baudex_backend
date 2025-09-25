import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryStatus } from '../entities/category.entity';

// ==================== BULK UPDATE STATUS ====================

export class BulkUpdateStatusDto {
  @IsArray({ message: 'categoryIds debe ser un array' })
  @IsUUID('4', { each: true, message: 'Todos los IDs deben ser UUIDs válidos' })
  categoryIds: string[];

  @IsEnum(CategoryStatus, { message: 'El estado debe ser válido' })
  status: CategoryStatus;

  @IsOptional()
  @IsString({ message: 'La razón debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La razón no puede exceder 500 caracteres' })
  reason?: string;
}

// ==================== BULK RESTORE ====================

export class BulkRestoreDto {
  @IsArray({ message: 'categoryIds debe ser un array' })
  @IsUUID('4', { each: true, message: 'Todos los IDs deben ser UUIDs válidos' })
  categoryIds: string[];

  @IsOptional()
  @IsString({ message: 'La razón debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La razón no puede exceder 500 caracteres' })
  reason?: string;
}

// ==================== REORDER CATEGORIES ====================

export class ReorderCategoryItemDto {
  @IsUUID('4', { message: 'El ID debe ser un UUID válido' })
  id: string;

  @IsNumber({}, { message: 'sortOrder debe ser un número' })
  @Min(0, { message: 'sortOrder debe ser mayor o igual a 0' })
  sortOrder: number;
}

export class ReorderCategoriesDto {
  @IsArray({ message: 'categories debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryItemDto)
  categories: ReorderCategoryItemDto[];
}

// ==================== BULK OPERATION RESULTS ====================

export class BulkOperationResultDto {
  id: string;
  success: boolean;
  category?: any;
  error?: string;
}

export class BulkOperationResponseDto {
  message: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  results: BulkOperationResultDto[];
  processedBy: string;
  processedAt: Date;
}
