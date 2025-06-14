import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryStatus } from '../entities/category.entity';

// ==================== IMPORT CATEGORY ====================

export class ImportCategoryDto {
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1000 caracteres',
  })
  description?: string;

  @IsString({ message: 'El slug es requerido' })
  @MinLength(2, { message: 'El slug debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El slug no puede exceder 50 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe contener solo letras minúsculas, números y guiones',
  })
  slug: string;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL válida' })
  image?: string;

  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'El estado debe ser válido' })
  status?: CategoryStatus;

  @IsOptional()
  @IsNumber({}, { message: 'sortOrder debe ser un número' })
  @Min(0, { message: 'sortOrder debe ser mayor o igual a 0' })
  sortOrder?: number;

  @IsOptional()
  @IsString({ message: 'parentSlug debe ser una cadena de texto válida' })
  parentSlug?: string; // Usamos slug en lugar de ID para importación
}

// ==================== IMPORT OPTIONS ====================

export class ImportOptionsDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'updateExisting debe ser un valor booleano' })
  updateExisting?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'skipDuplicates debe ser un valor booleano' })
  skipDuplicates?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'validateHierarchy debe ser un valor booleano' })
  validateHierarchy?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'dryRun debe ser un valor booleano' })
  dryRun?: boolean = false;
}

// ==================== IMPORT REQUEST ====================

export class ImportCategoriesDto {
  @IsArray({ message: 'categories debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => ImportCategoryDto)
  categories: ImportCategoryDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportOptionsDto)
  options?: ImportOptionsDto;
}

// ==================== EXPORT CATEGORY ====================

export class CategoryExportDto {
  id: string;
  name: string;
  description?: string;
  slug: string;
  image?: string;
  status: CategoryStatus;
  sortOrder: number;
  parentSlug?: string;
  parentName?: string;
  level: number;
  hasChildren: boolean;
  productsCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== IMPORT RESULT ====================

export class CategoryImportErrorDto {
  row: number;
  category: string;
  error: string;
  field?: string;
}

export class CategoryImportWarningDto {
  row: number;
  category: string;
  warning: string;
  field?: string;
}

export class CategoryImportResultDto {
  imported: number;
  updated: number;
  skipped: number;
  errors: CategoryImportErrorDto[];
  warnings: CategoryImportWarningDto[];
  executedBy: string;
  executedAt: Date;
  dryRun: boolean;
}

// ==================== EXPORT OPTIONS ====================

export class ExportOptionsDto {
  @IsOptional()
  @IsEnum(['json', 'csv', 'xlsx'], {
    message: 'El formato debe ser json, csv o xlsx',
  })
  format?: 'json' | 'csv' | 'xlsx' = 'json';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'includeDeleted debe ser un valor booleano' })
  includeDeleted?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'includeProductCount debe ser un valor booleano' })
  includeProductCount?: boolean = true;

  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'El estado debe ser válido' })
  statusFilter?: CategoryStatus;
}

// ==================== EXPORT RESPONSE ====================

export class CategoryExportResponseDto {
  format: string;
  data: CategoryExportDto[];
  totalRecords: number;
  exportedBy: string;
  exportedAt: Date;
  filters?: ExportOptionsDto;
}
