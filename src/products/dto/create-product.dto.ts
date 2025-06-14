// import {
//   IsString,
//   IsOptional,
//   IsEnum,
//   IsUUID,
//   IsNumber,
//   IsArray,
//   MinLength,
//   MaxLength,
//   Min,
//   Max,
//   Matches,
//   ValidateNested,
//   IsObject,
// } from 'class-validator';
// import { Type } from 'class-transformer';
// import { ProductStatus, ProductType } from '../entities/product.entity';
// import { CreateProductPriceDto } from './create-product-price.dto';

// export class CreateProductDto {
//   @IsString()
//   @MinLength(2)
//   @MaxLength(100)
//   name: string;

//   @IsOptional()
//   @IsString()
//   @MaxLength(2000)
//   description?: string;

//   @IsString()
//   @MinLength(2)
//   @MaxLength(50)
//   @Matches(/^[A-Z0-9-_]+$/, {
//     message:
//       'El SKU debe contener solo letras mayúsculas, números, guiones y guiones bajos',
//   })
//   sku: string;

//   @IsOptional()
//   @IsString()
//   @MaxLength(20)
//   barcode?: string;

//   @IsOptional()
//   @IsEnum(ProductType)
//   type?: ProductType;

//   @IsOptional()
//   @IsEnum(ProductStatus)
//   status?: ProductStatus;

//   @IsOptional()
//   @IsNumber({ maxDecimalPlaces: 2 })
//   @Min(0)
//   stock?: number;

//   @IsOptional()
//   @IsNumber({ maxDecimalPlaces: 2 })
//   @Min(0)
//   minStock?: number;

//   @IsOptional()
//   @IsString()
//   @MaxLength(20)
//   unit?: string;

//   @IsOptional()
//   @IsNumber({ maxDecimalPlaces: 2 })
//   @Min(0)
//   weight?: number;

//   @IsOptional()
//   @IsNumber({ maxDecimalPlaces: 2 })
//   @Min(0)
//   length?: number;

//   @IsOptional()
//   @IsNumber({ maxDecimalPlaces: 2 })
//   @Min(0)
//   width?: number;

//   @IsOptional()
//   @IsNumber({ maxDecimalPlaces: 2 })
//   @Min(0)
//   height?: number;

//   @IsOptional()
//   @IsArray()
//   @IsString({ each: true })
//   images?: string[];

//   @IsOptional()
//   @IsObject()
//   metadata?: Record<string, any>;

//   @IsUUID()
//   categoryId: string;

//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => CreateProductPriceDto)
//   prices: CreateProductPriceDto[];
// }

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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus, ProductType } from '../entities/product.entity';

export class CreateProductPriceDto {
  @IsEnum(['price1', 'price2', 'price3', 'special', 'cost'])
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El precio debe ser mayor o igual a 0' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'COP';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountPercentage?: number = 0;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  minQuantity?: number = 1;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProductDto {
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string;

  @IsString({ message: 'El SKU es requerido' })
  @MinLength(3, { message: 'El SKU debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El SKU no puede exceder 50 caracteres' })
  sku: string;

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
  type?: ProductType = ProductType.PRODUCT;

  @IsOptional()
  @IsEnum(ProductStatus, {
    message: 'El estado debe ser active, inactive o out_of_stock',
  })
  status?: ProductStatus = ProductStatus.ACTIVE;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El stock debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El stock debe ser mayor o igual a 0' })
  stock?: number = 0;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El stock mínimo debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El stock mínimo debe ser mayor o igual a 0' })
  minStock?: number = 0;

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

  @IsUUID('4', { message: 'El ID de la categoría debe ser un UUID válido' })
  categoryId: string;

  @IsOptional()
  @IsArray({ message: 'Los precios deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductPriceDto)
  prices?: CreateProductPriceDto[];
}
