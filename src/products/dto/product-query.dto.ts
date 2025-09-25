import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsString,
  Min,
  Max,
  IsIn,
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
  @IsUUID('4', { message: 'El ID de categoría debe ser un UUID válido' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de creador debe ser un UUID válido' })
  createdById?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minStock debe ser un número' })
  @Min(0, { message: 'minStock debe ser un número positivo' })
  minStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxStock debe ser un número' })
  @Min(0, { message: 'maxStock debe ser un número positivo' })
  maxStock?: number;

  // ==================== FILTROS DE PRECIO ====================
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minPrice debe ser un número' })
  @Min(0, { message: 'minPrice debe ser un número positivo' })
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxPrice debe ser un número' })
  @Min(0, { message: 'maxPrice debe ser un número positivo' })
  maxPrice?: number;

  @IsOptional()
  @IsEnum(PriceType, { message: 'Tipo de precio no válido' })
  priceType?: PriceType;

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
  // ✅ AGREGADO: Propiedad sortBy que faltaba
  @IsOptional()
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  @IsIn(
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
      'categoryId',
      'createdById',
    ],
    {
      message:
        'El campo de ordenamiento no es válido. Valores permitidos: name, sku, barcode, stock, minStock, status, type, createdAt, updatedAt, categoryId, createdById',
    },
  )
  sortBy?: string = 'createdAt';

  // ✅ AGREGADO: Propiedad sortOrder que faltaba
  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  // ✅ MANTENIDO: Las propiedades orderBy y order por compatibilidad
  @IsOptional()
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  @IsIn(
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
      'categoryId',
      'createdById',
    ],
    {
      message: 'El campo de ordenamiento no es válido.',
    },
  )
  orderBy?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  order?: 'ASC' | 'DESC' = 'ASC';
}
