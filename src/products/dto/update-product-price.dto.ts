// import { PartialType } from '@nestjs/mapped-types';
// import { IsOptional, IsUUID } from 'class-validator';
// import { CreateProductPriceDto } from './create-product-price.dto';

// export class UpdateProductPriceDto extends PartialType(CreateProductPriceDto) {
//   @IsOptional()
//   @IsUUID('4', { message: 'El ID del precio debe ser un UUID válido' })
//   id?: string; // Para identificar qué precio actualizar, null para crear nuevo
// }

import { PartialType } from '@nestjs/mapped-types';
import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { PriceType, PriceStatus } from '../entities/product-price.entity';

export class UpdateProductPriceDto {
  @IsOptional()
  @IsUUID('4', { message: 'El ID del precio debe ser un UUID válido' })
  id?: string; // Para identificar qué precio actualizar, null para crear nuevo

  @IsEnum(PriceType, { message: 'El tipo de precio debe ser válido' })
  type: PriceType;

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
  currency?: string;

  @IsOptional()
  @IsEnum(PriceStatus)
  status?: PriceStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  minQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
