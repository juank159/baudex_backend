import { ApiProperty } from '@nestjs/swagger';
import {
  MovementType,
  MovementStatus,
} from '../entities/inventory-movement.entity';

export class TransferMovementResponseDto {
  @ApiProperty({ description: 'ID único del movimiento' })
  id: string;

  @ApiProperty({ description: 'Número del movimiento' })
  movementNumber: string;

  @ApiProperty({ enum: MovementType, description: 'Tipo de movimiento' })
  type: MovementType;

  @ApiProperty({ enum: MovementStatus, description: 'Estado del movimiento' })
  status: MovementStatus;

  @ApiProperty({ description: 'Fecha del movimiento' })
  movementDate: Date;

  @ApiProperty({ description: 'Cantidad' })
  quantity: number;

  @ApiProperty({ description: 'Costo unitario' })
  unitCost: number;

  @ApiProperty({ description: 'Costo total' })
  totalCost: number;

  @ApiProperty({ description: 'Precio unitario', nullable: true })
  unitPrice: number | null;

  @ApiProperty({ description: 'Precio total', nullable: true })
  totalPrice: number | null;

  @ApiProperty({ description: 'Stock después del movimiento' })
  stockAfter: number;

  @ApiProperty({ description: 'Valor del stock después del movimiento' })
  stockValueAfter: number;

  @ApiProperty({ description: 'Tipo de referencia', nullable: true })
  referenceType: string | null;

  @ApiProperty({ description: 'Número de referencia', nullable: true })
  referenceNumber: string | null;

  @ApiProperty({ description: 'ID de referencia', nullable: true })
  referenceId: string | null;

  @ApiProperty({ description: 'Notas', nullable: true })
  notes: string | null;

  @ApiProperty({ description: 'Metadatos adicionales' })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'ID de la organización' })
  organizationId: string;

  @ApiProperty({ description: 'ID del producto' })
  productId: string;

  @ApiProperty({ description: 'ID del usuario que realizó el movimiento' })
  performedById: string;

  @ApiProperty({ description: 'ID del almacén', nullable: true })
  warehouseId: string | null;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  updatedAt: Date;
}

export class TransferResponseDto {
  @ApiProperty({
    type: TransferMovementResponseDto,
    description: 'Movimiento de salida',
  })
  transferOut: TransferMovementResponseDto;

  @ApiProperty({
    type: TransferMovementResponseDto,
    description: 'Movimiento de entrada',
  })
  transferIn: TransferMovementResponseDto;
}
