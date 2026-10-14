// src/customer-credits/dto/add-credit-payment.dto.ts
import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../invoices/entities/invoice.entity';

/**
 * DTO para agregar un abono a un crédito
 */
export class AddCreditPaymentDto {
  @ApiProperty({
    description: 'Monto del abono',
    example: 50000,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
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
    description: 'Fecha del pago',
    example: '2024-01-20T10:30:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser válida' })
  paymentDate?: string;

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

  @ApiPropertyOptional({
    description:
      'Clave de idempotencia del abono (única por abono, generada en el cliente). ' +
      'Reenviar la misma clave no duplica el pago. También se acepta en el header Idempotency-Key.',
    example: '3f1c2a52-7d0e-4c0b-9d0e-0b7f2f2a9c11',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}
