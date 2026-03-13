import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/invoice.entity';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 150.00,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Payment date',
    example: '2024-01-15T10:30:00Z',
  })
  paymentDate: Date;

  @ApiProperty({
    description: 'Payment reference number',
    example: 'REF-12345',
    nullable: true,
  })
  reference?: string;

  @ApiProperty({
    description: 'Additional notes about the payment',
    example: 'Payment received in full',
    nullable: true,
  })
  notes?: string;

  @ApiProperty({
    description: 'Invoice ID for this payment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  invoiceId: string;

  @ApiProperty({
    description: 'ID of user who created the payment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  createdById: string;

  @ApiProperty({
    description: 'Organization ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  organizationId: string;

  @ApiProperty({
    description: 'Payment creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Payment last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Código de moneda del pago (null = moneda base)',
    example: 'USD',
    nullable: true,
  })
  paymentCurrency?: string;

  @ApiPropertyOptional({
    description: 'Monto en la moneda del pago',
    example: 50.00,
    nullable: true,
  })
  paymentCurrencyAmount?: number;

  @ApiPropertyOptional({
    description: 'Tasa de cambio usada (1 extranjera = X base)',
    example: 4000,
    nullable: true,
  })
  exchangeRate?: number;
}