// src/subscriptions/dto/renew-subscription.dto.ts
import {
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RenewSubscriptionDto {
  @ApiProperty({
    description: 'ID de la organización que se quiere renovar',
    example: 'c99d0fd8-667b-4b8b-a52b-10380fbbf611',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'El organizationId debe ser un UUID válido' })
  organizationId: string;

  @ApiProperty({
    description: 'Plan de suscripción a asignar',
    example: 'basic',
    enum: ['trial', 'basic', 'premium', 'enterprise'],
  })
  @IsIn(['trial', 'basic', 'premium', 'enterprise'], {
    message: 'El plan debe ser uno de: trial, basic, premium, enterprise',
  })
  plan: 'trial' | 'basic' | 'premium' | 'enterprise';

  @ApiProperty({
    description: 'Duración en meses de la suscripción',
    example: 1,
    minimum: 1,
    maximum: 36,
  })
  @IsInt({ message: 'La duración debe ser un número entero' })
  @Min(1, { message: 'La duración mínima es 1 mes' })
  @Max(36, { message: 'La duración máxima es 36 meses' })
  durationMonths: number;

  @ApiPropertyOptional({
    description: 'Precio de la suscripción (opcional)',
    example: 29.99,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El precio debe ser un número válido' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  price?: number;

  @ApiPropertyOptional({
    description: 'Moneda de la suscripción (opcional)',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Método de pago utilizado (opcional)',
    example: 'credit_card',
  })
  @IsOptional()
  paymentMethod?: string;
}

export class RenewSubscriptionResponseDto {
  @ApiProperty({
    description: 'Indica si la renovación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Suscripción renovada exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'Datos de la nueva suscripción creada',
  })
  data: {
    subscriptionId: string;
    organizationId: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
    previousSubscriptions: number;
  };

  @ApiProperty({
    description: 'Timestamp de cuando se realizó la operación',
    example: '2025-07-27T03:30:19.306Z',
  })
  timestamp: string;
}
