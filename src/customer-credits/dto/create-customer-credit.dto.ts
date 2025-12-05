// src/customer-credits/dto/create-customer-credit.dto.ts
import {
  IsNumber,
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO para crear un crédito de cliente
 */
export class CreateCustomerCreditDto {
  @ApiProperty({
    description: 'Monto del crédito (deuda)',
    example: 150000,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  originalAmount: number;

  @ApiProperty({
    description: 'ID del cliente',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'El ID del cliente debe ser un UUID válido' })
  customerId: string;

  @ApiPropertyOptional({
    description: 'ID de la factura que originó el crédito',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'El ID de la factura debe ser un UUID válido' })
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento del crédito',
    example: '2024-02-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vencimiento debe ser una fecha válida' })
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Descripción del crédito',
    example: 'Saldo pendiente de factura F-001',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Notas internas',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: '[DEPRECATED] Usar saldo a favor - ahora es automático',
    deprecated: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  useClientBalance?: boolean;

  @ApiPropertyOptional({
    description: 'Si es true, NO aplicar automáticamente el saldo a favor del cliente. Por defecto es false (siempre aplica saldo automáticamente).',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  skipAutoBalance?: boolean;
}
