// src/customer-credits/dto/customer-credit-query.dto.ts
import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditStatus } from '../entities/customer-credit.entity';

/**
 * DTO para consultar créditos de clientes
 */
export class CustomerCreditQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de cliente',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4)
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del crédito',
    enum: CreditStatus,
    example: CreditStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(CreditStatus)
  status?: CreditStatus;

  @ApiPropertyOptional({
    description: 'Incluir créditos cancelados',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCancelled?: boolean;

  @ApiPropertyOptional({
    description: 'Solo créditos vencidos',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  overdueOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Fecha inicio para filtrar por fecha de creación',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha fin para filtrar por fecha de creación',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
