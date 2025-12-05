import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/invoice.entity';

/**
 * DTO para agregar un pago individual
 */
export class AddPaymentDto {
  @ApiProperty({
    description: 'Monto del pago',
    example: 150000,
    minimum: 0.01,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe tener máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount: number;

  @ApiProperty({
    description: 'Método de pago',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod, {
    message:
      'El método de pago debe ser cash, credit_card, debit_card, bank_transfer, check, credit u other',
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'ID de la cuenta bancaria donde se recibe el pago',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'El ID de la cuenta bancaria debe ser un UUID válido' })
  bankAccountId?: string;

  @ApiPropertyOptional({
    description: 'Fecha del pago',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de pago debe ser una fecha válida' })
  paymentDate?: string;

  @ApiPropertyOptional({
    description: 'Referencia del pago (número de transacción, etc)',
    example: 'TRX-12345',
  })
  @IsOptional()
  @IsString({ message: 'La referencia debe ser una cadena' })
  reference?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales del pago',
    example: 'Pago parcial acordado',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena' })
  notes?: string;
}

/**
 * DTO para un ítem de pago dentro de pagos múltiples
 */
export class PaymentItemDto {
  @ApiProperty({
    description: 'Monto de este pago específico',
    example: 100000,
    minimum: 0.01,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe tener máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount: number;

  @ApiProperty({
    description: 'Método de pago',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod, {
    message: 'Método de pago inválido',
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'ID de la cuenta bancaria donde se recibe el pago',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'El ID de la cuenta bancaria debe ser un UUID válido' })
  bankAccountId?: string;

  @ApiPropertyOptional({
    description: 'Referencia del pago',
    example: 'Nequi-12345',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Notas del pago',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO para agregar múltiples pagos a una factura en una sola transacción
 * Permite pagos parciales con diferentes métodos de pago
 * Ejemplo: $100,000 Nequi + $200,000 Efectivo
 */
export class AddMultiplePaymentsDto {
  @ApiProperty({
    description: 'Lista de pagos a aplicar',
    type: [PaymentItemDto],
    example: [
      { amount: 100000, paymentMethod: 'cash', bankAccountId: null },
      { amount: 200000, paymentMethod: 'bank_transfer', bankAccountId: '123e4567-e89b-12d3-a456-426614174000', reference: 'Nequi-12345' },
    ],
  })
  @IsArray({ message: 'Los pagos deben ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un pago' })
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  payments: PaymentItemDto[];

  @ApiPropertyOptional({
    description: 'Fecha de todos los pagos (si no se especifica, se usa la fecha actual)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de pago debe ser una fecha válida' })
  paymentDate?: string;

  @ApiPropertyOptional({
    description: 'Si es true y el total de pagos es menor que el saldo, crear crédito automáticamente',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  createCreditForRemaining?: boolean;

  @ApiPropertyOptional({
    description: 'Notas generales para todos los pagos',
  })
  @IsOptional()
  @IsString()
  generalNotes?: string;
}
