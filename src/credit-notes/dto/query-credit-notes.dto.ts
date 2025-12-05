// src/credit-notes/dto/query-credit-notes.dto.ts
import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditNoteStatus, CreditNoteType, CreditNoteReason } from '../entities/credit-note.entity';

/**
 * DTO para consultar notas de crédito con filtros y paginación
 */
export class QueryCreditNotesDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Límite de resultados por página',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Buscar por número de nota de crédito o número de factura',
    example: 'CN-001',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de factura',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de cliente',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: CreditNoteStatus,
    example: CreditNoteStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(CreditNoteStatus)
  status?: CreditNoteStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo',
    enum: CreditNoteType,
    example: CreditNoteType.PARTIAL,
  })
  @IsOptional()
  @IsEnum(CreditNoteType)
  type?: CreditNoteType;

  @ApiPropertyOptional({
    description: 'Filtrar por razón',
    enum: CreditNoteReason,
    example: CreditNoteReason.RETURNED_GOODS,
  })
  @IsOptional()
  @IsEnum(CreditNoteReason)
  reason?: CreditNoteReason;

  @ApiPropertyOptional({
    description: 'Fecha de inicio (formato ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin (formato ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    example: 'date',
    default: 'date',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'date';

  @ApiPropertyOptional({
    description: 'Orden de clasificación',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
