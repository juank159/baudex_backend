import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Número de línea' })
  @IsNumber()
  @Min(1)
  lineNumber: number;

  @ApiProperty({ description: 'Cantidad a ordenar' })
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({ description: 'Costo unitario' })
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional({ description: 'Porcentaje de impuesto del item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @ApiPropertyOptional({ description: 'Porcentaje de descuento del item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

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

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'ID del proveedor' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({ description: 'ID del almacén de destino' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Fecha esperada de entrega' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({
    description: 'Estado de la orden',
    enum: PurchaseOrderStatus,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Moneda', default: 'COP' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Porcentaje de impuestos' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @ApiPropertyOptional({ description: 'Porcentaje de descuento' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Monto de descuento' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Costo de envío' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ description: 'Notas de la orden' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Términos y condiciones' })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({ description: 'Referencia del proveedor' })
  @IsOptional()
  @IsString()
  supplierReference?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales' })
  @IsOptional()
  metadata?: Record<string, any>;

  // ─── Multi-moneda (opcional) ────────────────────────────────────────────
  // Si la compra se hizo en otra moneda que la base de la organización,
  // enviar los 3 campos. El `total` del DTO debe venir ya en moneda base
  // (el frontend calcula total = purchaseCurrencyAmount * exchangeRate).
  @ApiPropertyOptional({
    description: 'Código de moneda de la compra (null = base de la organización)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  purchaseCurrency?: string;

  @ApiPropertyOptional({
    description: 'Monto total en la moneda de la compra (antes de convertir a base)',
    example: 2500.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  purchaseCurrencyAmount?: number;

  @ApiPropertyOptional({
    description:
      'Tasa: 1 moneda extranjera = X moneda base. Ej: 1 USD = 4000 COP → 4000',
    example: 4000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  exchangeRate?: number;

  @ApiProperty({
    description: 'Items de la orden',
    type: [CreatePurchaseOrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
