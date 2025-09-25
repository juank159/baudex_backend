import {
  IsString,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
  IsArray,
} from 'class-validator';

// ==================== SLUG VALIDATION ====================

export class ValidateSlugDto {
  @IsString({ message: 'El slug debe ser una cadena de texto' })
  @MinLength(2, { message: 'El slug debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El slug no puede exceder 50 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe contener solo letras minúsculas, números y guiones',
  })
  slug: string;

  @IsOptional()
  @IsUUID('4', { message: 'excludeId debe ser un UUID válido' })
  excludeId?: string;
}

export class GenerateSlugDto {
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;
}

// ==================== SLUG VALIDATION RESPONSE ====================

export class SlugValidationResponseDto {
  slug: string;
  valid: boolean;
  available: boolean;
  suggestions?: string[];
  message: string;
}

export class GenerateSlugResponseDto {
  slug: string;
  generated: boolean;
  suggestions?: string[];
}

// ==================== CATEGORY VALIDATION ====================

export class CategoryValidationErrorDto {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export class CategoryValidationWarningDto {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export class CategoryValidationDto {
  isValid: boolean;
  errors: CategoryValidationErrorDto[];
  warnings: CategoryValidationWarningDto[];
  checkedAt: Date;
}

// ==================== HIERARCHY VALIDATION ====================

export class ValidateHierarchyDto {
  @IsUUID('4', { message: 'categoryId debe ser un UUID válido' })
  categoryId: string;

  @IsOptional()
  @IsUUID('4', { message: 'newParentId debe ser un UUID válido' })
  newParentId?: string;
}

export class HierarchyValidationResponseDto {
  valid: boolean;
  wouldCreateCycle: boolean;
  maxDepthExceeded: boolean;
  currentDepth: number;
  maxAllowedDepth: number;
  message: string;
}

// ==================== BATCH VALIDATION ====================

export class BatchValidationDto {
  @IsArray({ message: 'categoryIds debe ser un array' })
  @IsUUID('4', { each: true, message: 'Todos los IDs deben ser UUIDs válidos' })
  categoryIds: string[];
}

export class BatchValidationResultDto {
  categoryId: string;
  valid: boolean;
  errors: CategoryValidationErrorDto[];
  warnings: CategoryValidationWarningDto[];
}

export class BatchValidationResponseDto {
  totalChecked: number;
  validCount: number;
  invalidCount: number;
  results: BatchValidationResultDto[];
  checkedAt: Date;
}

// ==================== EMAIL/SLUG AVAILABILITY ====================

export class CheckAvailabilityDto {
  @IsString({ message: 'El valor es requerido' })
  value: string;

  @IsOptional()
  @IsUUID('4', { message: 'excludeId debe ser un UUID válido' })
  excludeId?: string;
}

export class AvailabilityResponseDto {
  value: string;
  available: boolean;
  message: string;
  suggestions?: string[];
}
