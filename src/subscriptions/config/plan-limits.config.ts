// src/subscriptions/config/plan-limits.config.ts

import { SubscriptionPlan } from '../entities/subscription.entity';

/**
 * Configuración de límites por plan de suscripción
 * -1 significa ilimitado
 */
export interface PlanLimits {
  maxProducts: number;
  maxCustomers: number;
  maxInvoicesPerMonth: number;
  maxUsers: number;
  maxDevices: number;
  maxStorageMB: number;
  maxExpensesPerMonth: number;
  maxCategoriesPerLevel: number;
  features: PlanFeatures;
}

export interface PlanFeatures {
  canExportReports: boolean;
  canExportPdf: boolean;
  canExportExcel: boolean;
  canUseThermalPrinter: boolean;
  canAccessAdvancedReports: boolean;
  canUseMultipleWarehouses: boolean;
  canUseApiIntegrations: boolean;
  canUseBulkOperations: boolean;
  canUseCustomBranding: boolean;
  canAccessAuditLogs: boolean;
  canUseAdvancedInventory: boolean;
  canUseCreditNotes: boolean;
  canUseCustomerCredits: boolean;
  canUsePurchaseOrders: boolean;
  canUseMultipleCurrencies: boolean;
  canUseAdvancedPricing: boolean;
  canScheduleReports: boolean;
  canUseEmailNotifications: boolean;
  prioritySupport: boolean;
}

/**
 * Features habilitadas para todos los planes
 * Todas las funcionalidades están disponibles sin restricción
 */
const ALL_FEATURES_ENABLED: PlanFeatures = {
  canExportReports: true,
  canExportPdf: true,
  canExportExcel: true,
  canUseThermalPrinter: true,
  canAccessAdvancedReports: true,
  canUseMultipleWarehouses: true,
  canUseApiIntegrations: true,
  canUseBulkOperations: true,
  canUseCustomBranding: true,
  canAccessAuditLogs: true,
  canUseAdvancedInventory: true,
  canUseCreditNotes: true,
  canUseCustomerCredits: true,
  canUsePurchaseOrders: true,
  canUseMultipleCurrencies: true,
  canUseAdvancedPricing: true,
  canScheduleReports: true,
  canUseEmailNotifications: true,
  prioritySupport: true,
};

/**
 * Recursos ilimitados para todos los planes
 * La ÚNICA restricción real es maxDevices (dispositivos conectados)
 */
const UNLIMITED_RESOURCES = {
  maxProducts: -1,
  maxCustomers: -1,
  maxInvoicesPerMonth: -1,
  maxUsers: -1,
  maxStorageMB: -1,
  maxExpensesPerMonth: -1,
  maxCategoriesPerLevel: -1,
};

/**
 * Límites del Plan Trial (Prueba gratuita - 30 días)
 * Solo limita: máximo 2 dispositivos conectados simultáneamente
 */
export const TRIAL_LIMITS: PlanLimits = {
  ...UNLIMITED_RESOURCES,
  maxDevices: 2,
  features: ALL_FEATURES_ENABLED,
};

/**
 * Límites del Plan Básico
 * Solo limita: máximo 2 dispositivos conectados simultáneamente
 */
export const BASIC_LIMITS: PlanLimits = {
  ...UNLIMITED_RESOURCES,
  maxDevices: 2,
  features: ALL_FEATURES_ENABLED,
};

/**
 * Límites del Plan Premium
 * Solo limita: máximo 3 dispositivos conectados simultáneamente
 */
export const PREMIUM_LIMITS: PlanLimits = {
  ...UNLIMITED_RESOURCES,
  maxDevices: 3,
  features: ALL_FEATURES_ENABLED,
};

/**
 * Límites del Plan Enterprise
 * Solo limita: máximo 5 dispositivos conectados simultáneamente
 */
export const ENTERPRISE_LIMITS: PlanLimits = {
  ...UNLIMITED_RESOURCES,
  maxDevices: 5,
  features: ALL_FEATURES_ENABLED,
};

/**
 * Mapa de límites por plan
 */
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.TRIAL]: TRIAL_LIMITS,
  [SubscriptionPlan.BASIC]: BASIC_LIMITS,
  [SubscriptionPlan.PREMIUM]: PREMIUM_LIMITS,
  [SubscriptionPlan.ENTERPRISE]: ENTERPRISE_LIMITS,
};

/**
 * Obtener límites para un plan específico
 */
export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan] || TRIAL_LIMITS;
}

/**
 * Verificar si un límite es ilimitado
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Obtener el porcentaje de uso
 */
export function getUsagePercentage(current: number, limit: number): number {
  if (isUnlimited(limit)) return 0;
  if (limit === 0) return 100;
  return Math.round((current / limit) * 100);
}

/**
 * Verificar si está cerca del límite (80% o más)
 */
export function isNearLimit(current: number, limit: number): boolean {
  if (isUnlimited(limit)) return false;
  return getUsagePercentage(current, limit) >= 80;
}

/**
 * Verificar si ha alcanzado el límite
 */
export function hasReachedLimit(current: number, limit: number): boolean {
  if (isUnlimited(limit)) return false;
  return current >= limit;
}

/**
 * Nombres de planes para mostrar
 */
export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.TRIAL]: 'Plan de Prueba',
  [SubscriptionPlan.BASIC]: 'Plan Básico',
  [SubscriptionPlan.PREMIUM]: 'Plan Premium',
  [SubscriptionPlan.ENTERPRISE]: 'Plan Empresarial',
};

/**
 * Precios base por plan (USD)
 */
export const PLAN_BASE_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.TRIAL]: 0,
  [SubscriptionPlan.BASIC]: 29.99,
  [SubscriptionPlan.PREMIUM]: 59.99,
  [SubscriptionPlan.ENTERPRISE]: 199.99,
};

/**
 * Duración de prueba en días
 */
export const TRIAL_DURATION_DAYS = 30;

/**
 * Período de gracia en días después de expiración
 */
export const GRACE_PERIOD_DAYS = 3;
