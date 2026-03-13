import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../subscriptions/entities/subscription.entity';

export class OrganizationResponseDto {
  @ApiProperty({
    description: 'ID único de la organización',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Nombre de la organización',
    example: 'Mi Empresa S.A.',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Slug único de la organización',
    example: 'mi-empresa',
  })
  @Expose()
  slug: string;

  @ApiPropertyOptional({
    description: 'Dominio personalizado',
    example: 'facturacion.miempresa.com',
  })
  @Expose()
  domain?: string;

  @ApiPropertyOptional({
    description: 'URL del logo',
    example: 'https://miempresa.com/logo.png',
  })
  @Expose()
  logo?: string;

  @ApiProperty({
    description: 'Plan de suscripción actual',
    enum: SubscriptionPlan,
  })
  @Expose()
  subscriptionPlan: SubscriptionPlan;

  @ApiProperty({
    description: 'Estado de la organización',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'Si la organización acepta pagos en múltiples monedas',
    example: false,
  })
  @Expose()
  multiCurrencyEnabled: boolean;

  @ApiProperty({
    description: 'Moneda por defecto',
    example: 'USD',
  })
  @Expose()
  currency: string;

  @ApiProperty({
    description: 'Idioma por defecto',
    example: 'en',
  })
  @Expose()
  locale: string;

  @ApiProperty({
    description: 'Zona horaria',
    example: 'America/New_York',
  })
  @Expose()
  timezone: string;

  @ApiPropertyOptional({
    description: 'Configuraciones de la organización',
  })
  @Expose()
  settings: Record<string, any>;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-01T00:00:00Z',
  })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  createdAt: string;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-01-01T00:00:00Z',
  })
  @Expose()
  @Transform(({ value }) => value?.toISOString())
  updatedAt: string;

  @ApiProperty({
    description: 'Nombre para mostrar',
    example: 'Mi Empresa S.A.',
  })
  @Expose()
  @Transform(({ obj }) => obj.name || obj.slug)
  displayName: string;

  @ApiProperty({
    description: 'Si el plan está activo',
    example: true,
  })
  @Expose()
  @Transform(({ obj }) => obj.isActive && obj.subscriptionPlan !== null)
  isActivePlan: boolean;

  @ApiProperty({
    description: 'Estado de la suscripción',
    enum: SubscriptionStatus,
  })
  @Expose()
  subscriptionStatus: SubscriptionStatus;

  @ApiProperty({
    description: 'Si tiene suscripción válida',
    example: true,
  })
  @Expose()
  hasValidSubscription: boolean;

  @ApiProperty({
    description: 'Si el período de prueba ha expirado',
    example: false,
  })
  @Expose()
  isTrialExpired: boolean;

  @ApiProperty({
    description: 'Días hasta la expiración',
    example: 15,
  })
  @Expose()
  daysUntilExpiration: number;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del período de prueba',
    example: '2024-01-01T00:00:00Z',
  })
  @Expose()
  trialStartDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del período de prueba',
    example: '2024-02-01T00:00:00Z',
  })
  @Expose()
  trialEndDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio de la suscripción',
    example: '2024-02-01T00:00:00Z',
  })
  @Expose()
  subscriptionStartDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin de la suscripción',
    example: '2025-02-01T00:00:00Z',
  })
  @Expose()
  subscriptionEndDate?: string;

  @ApiPropertyOptional({
    description: 'Información completa de suscripción activa',
    type: 'object',
  })
  @Expose()
  subscription?: {
    id: string;
    plan: string;
    status: string;
    type: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    isExpired: boolean;
    isTrial: boolean;
    daysUntilExpiration: number;
    subscriptionProgress: number;
    remainingDays: number;
    maxUsers: number;
    autoRenew: boolean;
    price?: number;
    currency?: string;
    paymentMethod?: string;
    nextBillingDate?: string;
    trialEndsAt?: string;
    billingCycle: number;
  };
}

export class OrganizationStatsDto {
  @ApiProperty({
    description: 'Número total de usuarios',
    example: 5,
  })
  totalUsers: number;

  @ApiProperty({
    description: 'Número total de productos',
    example: 150,
  })
  totalProducts: number;

  @ApiProperty({
    description: 'Número total de clientes',
    example: 45,
  })
  totalCustomers: number;

  @ApiProperty({
    description: 'Número total de facturas',
    example: 120,
  })
  totalInvoices: number;

  @ApiProperty({
    description: 'Ingresos totales',
    example: 25000.5,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Facturas del mes actual',
    example: 15,
  })
  currentMonthInvoices: number;

  @ApiProperty({
    description: 'Ingresos del mes actual',
    example: 3500.75,
  })
  currentMonthRevenue: number;
}
