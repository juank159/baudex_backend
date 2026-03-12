// src/subscriptions/dto/subscription-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan, SubscriptionStatus, SubscriptionType } from '../entities/subscription.entity';

/**
 * DTO para características del plan
 */
export class PlanFeaturesDto {
  @ApiProperty({ description: 'Puede exportar reportes' })
  canExportReports: boolean;

  @ApiProperty({ description: 'Puede exportar PDF' })
  canExportPdf: boolean;

  @ApiProperty({ description: 'Puede exportar Excel' })
  canExportExcel: boolean;

  @ApiProperty({ description: 'Puede usar impresora térmica' })
  canUseThermalPrinter: boolean;

  @ApiProperty({ description: 'Puede acceder a reportes avanzados' })
  canAccessAdvancedReports: boolean;

  @ApiProperty({ description: 'Puede usar múltiples almacenes' })
  canUseMultipleWarehouses: boolean;

  @ApiProperty({ description: 'Puede usar integraciones API' })
  canUseApiIntegrations: boolean;

  @ApiProperty({ description: 'Puede usar operaciones masivas' })
  canUseBulkOperations: boolean;

  @ApiProperty({ description: 'Puede usar branding personalizado' })
  canUseCustomBranding: boolean;

  @ApiProperty({ description: 'Puede acceder a logs de auditoría' })
  canAccessAuditLogs: boolean;

  @ApiProperty({ description: 'Puede usar inventario avanzado' })
  canUseAdvancedInventory: boolean;

  @ApiProperty({ description: 'Puede usar notas de crédito' })
  canUseCreditNotes: boolean;

  @ApiProperty({ description: 'Puede usar créditos de cliente' })
  canUseCustomerCredits: boolean;

  @ApiProperty({ description: 'Puede usar órdenes de compra' })
  canUsePurchaseOrders: boolean;

  @ApiProperty({ description: 'Puede usar múltiples monedas' })
  canUseMultipleCurrencies: boolean;

  @ApiProperty({ description: 'Puede usar precios avanzados' })
  canUseAdvancedPricing: boolean;

  @ApiProperty({ description: 'Puede programar reportes' })
  canScheduleReports: boolean;

  @ApiProperty({ description: 'Puede usar notificaciones por email' })
  canUseEmailNotifications: boolean;

  @ApiProperty({ description: 'Tiene soporte prioritario' })
  prioritySupport: boolean;
}

/**
 * DTO para límites del plan
 */
export class PlanLimitsDto {
  @ApiProperty({ description: 'Máximo de productos (-1 = ilimitado)' })
  maxProducts: number;

  @ApiProperty({ description: 'Máximo de clientes (-1 = ilimitado)' })
  maxCustomers: number;

  @ApiProperty({ description: 'Máximo de facturas por mes (-1 = ilimitado)' })
  maxInvoicesPerMonth: number;

  @ApiProperty({ description: 'Máximo de usuarios (-1 = ilimitado)' })
  maxUsers: number;

  @ApiProperty({ description: 'Máximo de dispositivos conectados (-1 = ilimitado)' })
  maxDevices: number;

  @ApiProperty({ description: 'Máximo de almacenamiento en MB (-1 = ilimitado)' })
  maxStorageMB: number;

  @ApiProperty({ description: 'Máximo de gastos por mes (-1 = ilimitado)' })
  maxExpensesPerMonth: number;

  @ApiProperty({ description: 'Máximo de categorías por nivel (-1 = ilimitado)' })
  maxCategoriesPerLevel: number;

  @ApiProperty({ type: PlanFeaturesDto, description: 'Características del plan' })
  features: PlanFeaturesDto;
}

/**
 * DTO para la suscripción actual
 */
export class SubscriptionCurrentDto {
  @ApiProperty({ description: 'ID de la suscripción' })
  id: string;

  @ApiProperty({ description: 'ID de la organización' })
  organizationId: string;

  @ApiProperty({ enum: SubscriptionPlan, description: 'Plan de suscripción' })
  plan: SubscriptionPlan;

  @ApiProperty({ description: 'Nombre del plan para mostrar' })
  planDisplayName: string;

  @ApiProperty({ enum: SubscriptionStatus, description: 'Estado de la suscripción' })
  status: SubscriptionStatus;

  @ApiProperty({ enum: SubscriptionType, description: 'Tipo de suscripción' })
  type: SubscriptionType;

  @ApiProperty({ description: 'Fecha de inicio' })
  startDate: Date;

  @ApiProperty({ description: 'Fecha de fin' })
  endDate: Date;

  @ApiProperty({ description: 'Si la suscripción está activa' })
  isActive: boolean;

  @ApiProperty({ description: 'Si la suscripción ha expirado' })
  isExpired: boolean;

  @ApiProperty({ description: 'Si es plan de prueba' })
  isTrial: boolean;

  @ApiProperty({ description: 'Días hasta expiración' })
  daysUntilExpiration: number;

  @ApiProperty({ description: 'Progreso de la suscripción (0-1)' })
  subscriptionProgress: number;

  @ApiProperty({ description: 'Días restantes' })
  remainingDays: number;

  @ApiProperty({ description: 'Máximo de usuarios permitidos' })
  maxUsers: number;

  @ApiProperty({ description: 'Si tiene auto-renovación activa' })
  autoRenew: boolean;

  @ApiPropertyOptional({ description: 'Precio de la suscripción' })
  price?: number;

  @ApiPropertyOptional({ description: 'Moneda' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Método de pago' })
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Próxima fecha de facturación' })
  nextBillingDate?: Date;

  @ApiPropertyOptional({ description: 'Fecha de fin de prueba' })
  trialEndsAt?: Date;

  @ApiProperty({ description: 'Ciclo de facturación (0=único, 1=mensual, 12=anual)' })
  billingCycle: number;

  @ApiProperty({ type: PlanLimitsDto, description: 'Límites del plan' })
  limits: PlanLimitsDto;
}

/**
 * DTO para uso de recursos
 */
export class ResourceUsageDto {
  @ApiProperty({ description: 'Cantidad actual' })
  current: number;

  @ApiProperty({ description: 'Límite máximo (-1 = ilimitado)' })
  limit: number;

  @ApiProperty({ description: 'Si es ilimitado' })
  isUnlimited: boolean;

  @ApiProperty({ description: 'Porcentaje de uso (0-100)' })
  percentage: number;

  @ApiProperty({ description: 'Si está cerca del límite (>=80%)' })
  isNearLimit: boolean;

  @ApiProperty({ description: 'Si ha alcanzado el límite' })
  hasReachedLimit: boolean;
}

/**
 * DTO para advertencias de uso
 */
export class UsageWarningDto {
  @ApiProperty({ description: 'Recurso afectado' })
  resource: string;

  @ApiProperty({ description: 'Tipo de advertencia', enum: ['near_limit', 'at_limit', 'over_limit'] })
  type: 'near_limit' | 'at_limit' | 'over_limit';

  @ApiProperty({ description: 'Mensaje de advertencia' })
  message: string;

  @ApiProperty({ description: 'Porcentaje de uso' })
  percentage: number;
}

/**
 * DTO para uso de la suscripción
 */
export class SubscriptionUsageDto {
  @ApiProperty({ enum: SubscriptionPlan, description: 'Plan actual' })
  plan: SubscriptionPlan;

  @ApiProperty({ description: 'Nombre del plan para mostrar' })
  planDisplayName: string;

  @ApiProperty({ description: 'Si el plan tiene recursos ilimitados' })
  hasUnlimitedResources: boolean;

  @ApiProperty({ type: ResourceUsageDto, description: 'Uso de productos' })
  products: ResourceUsageDto;

  @ApiProperty({ type: ResourceUsageDto, description: 'Uso de clientes' })
  customers: ResourceUsageDto;

  @ApiProperty({ type: ResourceUsageDto, description: 'Uso de usuarios' })
  users: ResourceUsageDto;

  @ApiProperty({ type: ResourceUsageDto, description: 'Uso de facturas este mes' })
  invoicesThisMonth: ResourceUsageDto;

  @ApiProperty({ type: ResourceUsageDto, description: 'Uso de gastos este mes' })
  expensesThisMonth: ResourceUsageDto;

  @ApiProperty({ type: ResourceUsageDto, description: 'Uso de almacenamiento' })
  storage: ResourceUsageDto;

  @ApiProperty({ type: [UsageWarningDto], description: 'Advertencias de uso' })
  warnings: UsageWarningDto[];

  @ApiProperty({ description: 'Días hasta expiración de la suscripción' })
  daysUntilExpiration: number;

  @ApiProperty({ description: 'Fecha de próxima renovación' })
  nextRenewalDate?: Date;
}

/**
 * DTO para respuesta de límites del plan
 */
export class SubscriptionLimitsResponseDto {
  @ApiProperty({ enum: SubscriptionPlan, description: 'Plan actual' })
  plan: SubscriptionPlan;

  @ApiProperty({ description: 'Nombre del plan para mostrar' })
  planDisplayName: string;

  @ApiProperty({ type: PlanLimitsDto, description: 'Límites del plan' })
  limits: PlanLimitsDto;

  @ApiProperty({ description: 'Si es ilimitado en recursos principales' })
  isUnlimited: boolean;

  @ApiProperty({ description: 'Acciones permitidas con este plan' })
  allowedActions: string[];

  @ApiProperty({ description: 'Acciones restringidas con este plan' })
  restrictedActions: string[];
}

/**
 * DTO para respuesta genérica de suscripción
 */
export class SubscriptionResponseDto<T> {
  @ApiProperty({ description: 'Si la operación fue exitosa' })
  success: boolean;

  @ApiProperty({ description: 'Mensaje descriptivo' })
  message: string;

  @ApiProperty({ description: 'Datos de la respuesta' })
  data: T;

  @ApiProperty({ description: 'Timestamp de la respuesta' })
  timestamp: string;
}

/**
 * DTO para validación de acción
 */
export class ActionValidationDto {
  @ApiProperty({ description: 'Si la acción está permitida' })
  allowed: boolean;

  @ApiProperty({ description: 'Razón si no está permitida' })
  reason?: string;

  @ApiProperty({ description: 'Plan requerido para esta acción' })
  requiredPlan?: SubscriptionPlan;

  @ApiProperty({ description: 'Límite actual' })
  currentLimit?: number;

  @ApiProperty({ description: 'Uso actual' })
  currentUsage?: number;
}

/**
 * DTO para información de contacto de soporte
 */
export class SupportContactDto {
  @ApiProperty({ description: 'Teléfono de contacto' })
  phone: string;

  @ApiProperty({ description: 'Email de contacto' })
  email: string;

  @ApiProperty({ description: 'WhatsApp de contacto' })
  whatsapp: string;

  @ApiProperty({ description: 'URL de soporte' })
  supportUrl?: string;
}

/**
 * DTO para información completa de suscripción (usado en errores)
 */
export class SubscriptionInfoDto {
  @ApiProperty({ type: SubscriptionCurrentDto, description: 'Suscripción actual' })
  subscription: SubscriptionCurrentDto;

  @ApiProperty({ type: SubscriptionUsageDto, description: 'Uso actual' })
  usage: SubscriptionUsageDto;

  @ApiProperty({ type: SupportContactDto, description: 'Información de contacto' })
  contact: SupportContactDto;

  @ApiProperty({ description: 'Mensaje contextual para el usuario' })
  contextMessage: string;
}
