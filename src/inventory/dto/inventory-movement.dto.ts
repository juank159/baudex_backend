import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '../entities/inventory-movement.entity';

export class CreateInventoryMovementDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Tipo de movimiento', enum: MovementType })
  @IsEnum(MovementType)
  type: MovementType;

  @ApiProperty({
    description: 'Cantidad (positiva para entradas, negativa para salidas)',
  })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ description: 'Costo unitario' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Precio unitario (para ventas)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Tipo de referencia' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Número de referencia' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'ID de referencia' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional({
    description: 'ID del almacén donde se realiza el movimiento',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Fecha del movimiento' })
  @IsOptional()
  @IsDateString()
  movementDate?: string;

  @ApiPropertyOptional({ description: 'Notas del movimiento' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class InventoryAdjustmentDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Nueva cantidad de stock' })
  @IsNumber()
  @Min(0)
  newQuantity: number;

  @ApiProperty({ description: 'Razón del ajuste' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Costo unitario para valoración' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RelativeInventoryAdjustmentDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description:
      'Cantidad de ajuste (positiva para aumentar, negativa para disminuir)',
  })
  @IsNumber()
  adjustmentQuantity: number;

  @ApiPropertyOptional({
    description: 'ID del almacén donde se realiza el ajuste',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Notas del ajuste' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Fecha del movimiento' })
  @IsOptional()
  @IsDateString()
  movementDate?: string;

  @ApiPropertyOptional({
    description:
      'Costo unitario para valoración (requerido para ajustes positivos)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}
