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
 * Límites del Plan Trial (Prueba gratuita - 30 días)
 */
export const TRIAL_LIMITS: PlanLimits = {
  maxProducts: 50,
  maxCustomers: 25,
  maxInvoicesPerMonth: 100,
  maxUsers: 2,
  maxStorageMB: 100,
  maxExpensesPerMonth: 50,
  maxCategoriesPerLevel: 10,
  features: {
    canExportReports: false,
    canExportPdf: true,
    canExportExcel: false,
    canUseThermalPrinter: false,
    canAccessAdvancedReports: false,
    canUseMultipleWarehouses: false,
    canUseApiIntegrations: false,
    canUseBulkOperations: false,
    canUseCustomBranding: false,
    canAccessAuditLogs: false,
    canUseAdvancedInventory: false,
    canUseCreditNotes: true,
    canUseCustomerCredits: true,
    canUsePurchaseOrders: false,
    canUseMultipleCurrencies: false,
    canUseAdvancedPricing: false,
    canScheduleReports: false,
    canUseEmailNotifications: false,
    prioritySupport: false,
  },
};

/**
 * Límites del Plan Básico
 */
export const BASIC_LIMITS: PlanLimits = {
  maxProducts: 500,
  maxCustomers: 200,
  maxInvoicesPerMonth: 500,
  maxUsers: 5,
  maxStorageMB: 500,
  maxExpensesPerMonth: 200,
  maxCategoriesPerLevel: 25,
  features: {
    canExportReports: true,
    canExportPdf: true,
    canExportExcel: true,
    canUseThermalPrinter: true,
    canAccessAdvancedReports: false,
    canUseMultipleWarehouses: false,
    canUseApiIntegrations: false,
    canUseBulkOperations: true,
    canUseCustomBranding: false,
    canAccessAuditLogs: false,
    canUseAdvancedInventory: true,
    canUseCreditNotes: true,
    canUseCustomerCredits: true,
    canUsePurchaseOrders: true,
    canUseMultipleCurrencies: false,
    canUseAdvancedPricing: false,
    canScheduleReports: false,
    canUseEmailNotifications: true,
    prioritySupport: false,
  },
};

/**
 * Límites del Plan Premium
 */
export const PREMIUM_LIMITS: PlanLimits = {
  maxProducts: -1, // Ilimitado
  maxCustomers: -1, // Ilimitado
  maxInvoicesPerMonth: -1, // Ilimitado
  maxUsers: 15,
  maxStorageMB: 2000,
  maxExpensesPerMonth: -1, // Ilimitado
  maxCategoriesPerLevel: -1, // Ilimitado
  features: {
    canExportReports: true,
    canExportPdf: true,
    canExportExcel: true,
    canUseThermalPrinter: true,
    canAccessAdvancedReports: true,
    canUseMultipleWarehouses: true,
    canUseApiIntegrations: false,
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
    prioritySupport: false,
  },
};

/**
 * Límites del Plan Enterprise
 */
export const ENTERPRISE_LIMITS: PlanLimits = {
  maxProducts: -1,
  maxCustomers: -1,
  maxInvoicesPerMonth: -1,
  maxUsers: -1, // Ilimitado
  maxStorageMB: -1, // Ilimitado
  maxExpensesPerMonth: -1,
  maxCategoriesPerLevel: -1,
  features: {
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
  },
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
