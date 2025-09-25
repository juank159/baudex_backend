import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  IsString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportPeriod {
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  LAST_6_MONTHS = 'last_6_months',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom',
}

export class ProfitabilityReportQueryDto {
  @ApiPropertyOptional({ description: 'ID del producto específico' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'ID de la categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Período predefinido',
    enum: ReportPeriod,
  })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod;

  @ApiPropertyOptional({
    description: 'Número de productos top a mostrar',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: 'Incluir tendencias mensuales' })
  @IsOptional()
  includeTrends?: boolean;
}

export class InventoryValuationQueryDto {
  @ApiPropertyOptional({ description: 'ID del producto específico' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'ID de la categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Incluir análisis de antigüedad' })
  @IsOptional()
  includeAging?: boolean;

  @ApiPropertyOptional({ description: 'Incluir productos de movimiento lento' })
  @IsOptional()
  includeSlowMoving?: boolean;

  @ApiPropertyOptional({
    description: 'Días para considerar movimiento lento',
    default: 180,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  slowMovingDays?: number;
}

export class KardexReportQueryDto {
  @ApiPropertyOptional({ description: 'ID del producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Incluir detalles de lotes' })
  @IsOptional()
  includeBatchDetails?: boolean;

  @ApiPropertyOptional({
    description: 'Formato de exportación',
    enum: ['json', 'csv', 'excel'],
  })
  @IsOptional()
  @IsString()
  format?: string;
}

export class PurchaseHistoryQueryDto {
  @ApiPropertyOptional({ description: 'ID del producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'ID del proveedor' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Incluir análisis de tendencias de precios',
  })
  @IsOptional()
  includeTrends?: boolean;

  @ApiPropertyOptional({ description: 'Límite de registros', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
