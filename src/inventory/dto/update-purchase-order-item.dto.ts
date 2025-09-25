import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePurchaseOrderItemDto {
  @ApiPropertyOptional({
    description: 'ID del item existente (para actualizar)',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'ID del producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Número de línea' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  lineNumber?: number;

  @ApiPropertyOptional({ description: 'Cantidad a ordenar' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Cantidad recibida' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  receivedQuantity?: number;

  @ApiPropertyOptional({ description: 'Costo unitario' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Porcentaje de descuento del item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Porcentaje de impuestos del item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @ApiPropertyOptional({ description: 'Fecha esperada de entrega' })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Notas del item' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Metadatos del item' })
  @IsOptional()
  metadata?: Record<string, any>;
}
