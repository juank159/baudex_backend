import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { UpdatePurchaseOrderItemDto } from './update-purchase-order-item.dto';

export class UpdatePurchaseOrderDto {
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

  @ApiPropertyOptional({ description: 'Costo de envío' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ description: 'Notas de la orden' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'ID del proveedor' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Items de la orden para actualizar',
    type: [UpdatePurchaseOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderItemDto)
  items?: UpdatePurchaseOrderItemDto[];
}

// Exportar también el DTO del item para uso en el servicio
export { UpdatePurchaseOrderItemDto } from './update-purchase-order-item.dto';
