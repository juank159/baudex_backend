import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  MovementType,
  MovementStatus,
} from '../entities/inventory-movement.entity';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { BatchStatus } from '../entities/inventory-batch.entity';

export class InventoryMovementQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de movimiento',
    enum: [...Object.values(MovementType), 'transfer'],
  })
  @IsOptional()
  @IsIn([...Object.values(MovementType), 'transfer'])
  type?: MovementType | 'transfer';

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: MovementStatus,
  })
  @IsOptional()
  @IsEnum(MovementStatus)
  status?: MovementStatus;

  @ApiPropertyOptional({ description: 'Fecha de inicio' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Buscar por número de movimiento o referencia',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por almacén' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class PurchaseOrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por proveedor' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: PurchaseOrderStatus,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Fecha de inicio' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Buscar por número de orden o referencia',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class InventoryBatchQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: BatchStatus })
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @ApiPropertyOptional({ description: 'Filtrar por fecha de compra desde' })
  @IsOptional()
  @IsDateString()
  purchaseDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filtrar por fecha de compra hasta' })
  @IsOptional()
  @IsDateString()
  purchaseDateTo?: string;

  @ApiPropertyOptional({ description: 'Filtrar próximos a vencer (días)' })
  @IsOptional()
  expiringInDays?: number;

  @ApiPropertyOptional({ description: 'Buscar por número de lote' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Solo lotes activos' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Solo lotes vencidos' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  expiredOnly?: boolean;

  @ApiPropertyOptional({ description: 'Solo lotes próximos a vencer' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  nearExpiryOnly?: boolean;
}
