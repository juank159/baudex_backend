import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { PriceType, PriceStatus } from '../entities/product-price.entity';

export class CreateProductPriceDto {
  @IsEnum(PriceType)
  type: PriceType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsEnum(PriceStatus)
  status?: PriceStatus;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

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
