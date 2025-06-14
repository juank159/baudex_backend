import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsArray,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductStatus, ProductType } from '../entities/product.entity';

export class UpdateProductDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'El SKU debe ser una cadena de texto' })
  @MinLength(3, { message: 'El SKU debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El SKU no puede exceder 50 caracteres' })
  sku?: string;

  @IsOptional()
  @IsString({ message: 'El código de barras debe ser una cadena de texto' })
  @MaxLength(20, {
    message: 'El código de barras no puede exceder 20 caracteres',
  })
  barcode?: string;

  @IsOptional()
  @IsEnum(ProductType, {
    message: 'El tipo debe ser product o service',
  })
  type?: ProductType;

  @IsOptional()
  @IsEnum(ProductStatus, {
    message: 'El estado debe ser active, inactive o out_of_stock',
  })
  status?: ProductStatus;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El stock debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El stock debe ser mayor o igual a 0' })
  stock?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El stock mínimo debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El stock mínimo debe ser mayor o igual a 0' })
  minStock?: number;

  @IsOptional()
  @IsString({ message: 'La unidad debe ser una cadena de texto' })
  @MaxLength(20, { message: 'La unidad no puede exceder 20 caracteres' })
  unit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  length?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  width?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  height?: number;

  @IsOptional()
  @IsArray({ message: 'Las imágenes deben ser un array' })
  @IsString({ each: true, message: 'Cada imagen debe ser una URL válida' })
  images?: string[];

  @IsOptional()
  @IsObject({ message: 'Los metadatos deben ser un objeto' })
  metadata?: Record<string, any>;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de la categoría debe ser un UUID válido' })
  categoryId?: string;
}
