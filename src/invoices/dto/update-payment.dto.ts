import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/invoice.entity';

export class UpdatePaymentDto {
  @ApiPropertyOptional({
    description: 'Payment amount',
    example: 150.00,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe tener máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'El método de pago debe ser cash, credit_card, debit_card, bank_transfer, check, credit u other',
  })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Payment date',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de pago debe ser una fecha válida' })
  paymentDate?: string;

  @ApiPropertyOptional({
    description: 'Payment reference number',
    example: 'REF-12345',
  })
  @IsOptional()
  @IsString({ message: 'La referencia debe ser una cadena' })
  reference?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the payment',
    example: 'Payment received in full',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena' })
  notes?: string;
}