// src/modules/products/dto/product-query.dto.ts - AJUSTADO PARA TUS ENTIDADES
import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProductStatus, ProductType } from '../entities/product.entity';
import { PriceType } from '../entities/product-price.entity';

export class ProductQueryDto {
  // ==================== PAGINACIÓN ====================
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

  // ==================== BÚSQUEDA ====================
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  search?: string;

  // ==================== FILTROS DE PRODUCTO ====================
  @IsOptional()
  @IsEnum(ProductStatus, {
    message: 'El estado debe ser active, inactive o out_of_stock',
  })
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductType, {
    message: 'El tipo debe ser product o service',
  })
  type?: ProductType;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de la categoría debe ser un UUID válido' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del creador debe ser un UUID válido' })
  createdById?: string;

  // ==================== FILTROS DE STOCK ====================
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'inStock debe ser un valor booleano' })
  inStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'lowStock debe ser un valor booleano' })
  lowStock?: boolean;

  // ==================== FILTROS DE PRECIO ====================
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: 'El precio mínimo debe ser un número' })
  @Min(0, { message: 'El precio mínimo debe ser mayor o igual a 0' })
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: 'El precio máximo debe ser un número' })
  @Min(0, { message: 'El precio máximo debe ser mayor o igual a 0' })
  maxPrice?: number;

  @IsOptional()
  @IsEnum(PriceType, {
    message:
      'El tipo de precio debe ser price1, price2, price3, special o cost',
  })
  priceType?: PriceType = PriceType.PRICE1;

  // ==================== OPCIONES DE INCLUSIÓN ====================
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'includePrices debe ser un valor booleano' })
  includePrices?: boolean = true;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'includeCategory debe ser un valor booleano' })
  includeCategory?: boolean = true;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'includeCreatedBy debe ser un valor booleano' })
  includeCreatedBy?: boolean = false;

  // ==================== ORDENAMIENTO ====================
  @IsOptional()
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  @IsEnum(
    [
      'name',
      'sku',
      'barcode',
      'stock',
      'minStock',
      'status',
      'type',
      'createdAt',
      'updatedAt',
    ],
    {
      message: 'El campo de ordenamiento no es válido',
    },
  )
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
