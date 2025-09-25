import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Matches,
  IsUrl,
} from 'class-validator';
import { CategoryStatus } from '../entities/category.entity';

export class CreateCategoryDto {
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
  @IsUrl({}, { message: 'La imagen debe ser una URL válida' })
  image?: string;

  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'El estado debe ser válido' })
  status?: CategoryStatus = CategoryStatus.ACTIVE;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  sortOrder?: number;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del padre debe ser un UUID válido' })
  parentId?: string;

  // ==================== CAMPOS SEO ADICIONALES ====================

  @IsOptional()
  @IsString({ message: 'Meta title debe ser una cadena de texto' })
  @MaxLength(60, { message: 'Meta title no puede exceder 60 caracteres' })
  metaTitle?: string;

  @IsOptional()
  @IsString({ message: 'Meta description debe ser una cadena de texto' })
  @MaxLength(160, {
    message: 'Meta description no puede exceder 160 caracteres',
  })
  metaDescription?: string;

  @IsOptional()
  @IsString({ message: 'Meta keywords debe ser una cadena de texto' })
  @MaxLength(200, { message: 'Meta keywords no puede exceder 200 caracteres' })
  metaKeywords?: string;
}
