import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceivePurchaseOrderItemDto {
  @ApiProperty({ description: 'ID del item de la orden de compra' })
  @IsUUID()
  purchaseOrderItemId: string;

  @ApiProperty({ description: 'Cantidad recibida en buen estado' })
  @IsNumber()
  @Min(0)
  receivedQuantity: number;

  @ApiPropertyOptional({ description: 'Cantidad dañada' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  damagedQuantity?: number;

  @ApiPropertyOptional({ description: 'Cantidad faltante' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  missingQuantity?: number;

  @ApiPropertyOptional({
    description: 'Costo unitario real (si difiere del ordenado)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualUnitCost?: number;

  @ApiPropertyOptional({ description: 'Número de lote del proveedor' })
  @IsOptional()
  @IsString()
  supplierLotNumber?: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Notas de recepción' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty({
    description: 'Items recibidos',
    type: [ReceivePurchaseOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  receivedItems: ReceivePurchaseOrderItemDto[];

  @ApiPropertyOptional({
    description:
      'ID del almacén donde recibir (opcional - se auto-selecciona si solo hay uno)',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Fecha de recepción' })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiPropertyOptional({ description: 'Notas generales de recepción' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Metadatos de recepción' })
  @IsOptional()
  metadata?: Record<string, any>;
}
