import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, IsNull, Between } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionType,
} from '../entities/subscription.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import {
  PlanLimits,
  PlanFeatures,
  getPlanLimits,
  isUnlimited,
  getUsagePercentage,
  isNearLimit,
  hasReachedLimit,
  PLAN_DISPLAY_NAMES,
  GRACE_PERIOD_DAYS,
} from '../config/plan-limits.config';
import {
  SubscriptionCurrentDto,
  SubscriptionUsageDto,
  SubscriptionLimitsResponseDto,
  ResourceUsageDto,
  UsageWarningDto,
  PlanLimitsDto,
  PlanFeaturesDto,
  ActionValidationDto,
} from '../dto/subscription-response.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  // ==================== CREAR SUSCRIPCIONES ====================

  /**
   * Crear suscripción trial para una nueva organización
   */
  async createTrialSubscription(organizationId: string): Promise<Subscription> {
    // Verificar que la organización no tenga ya un trial
    const existingTrial = await this.subscriptionRepository.findOne({
      where: {
        organizationId,
        type: SubscriptionType.TRIAL,
      },
    });

    if (existingTrial) {
      throw new ConflictException(
        'La organización ya tiene un período de prueba',
      );
    }

    // Crear y guardar la suscripción
    const subscription = Subscription.createTrial(organizationId);
    const savedSubscription =
      await this.subscriptionRepository.save(subscription);

    // Actualizar campos deprecated en Organization para compatibilidad
    await this.syncOrganizationSubscriptionData(
      organizationId,
      savedSubscription,
    );

    return savedSubscription;
  }

  /**
   * Crear suscripción pagada
   */
  async createPaidSubscription(
    organizationId: string,
    plan: SubscriptionPlan,
    type: SubscriptionType,
    price: number,
    currency: string,
    durationMonths: number = 1,
    externalSubscriptionId?: string,
    paymentMethod?: string,
  ): Promise<Subscription> {
    // Cancelar suscripción activa anterior si existe
    await this.cancelActiveSubscription(organizationId, 'Upgraded to new plan');

    const subscription = Subscription.createPaidSubscription(
      organizationId,
      plan,
      type,
      price,
      currency,
      durationMonths,
    );

    if (externalSubscriptionId) {
      subscription.externalSubscriptionId = externalSubscriptionId;
    }

    if (paymentMethod) {
      subscription.paymentMethod = paymentMethod;
    }

    const savedSubscription =
      await this.subscriptionRepository.save(subscription);

    // Actualizar campos deprecated en Organization para compatibilidad
    await this.syncOrganizationSubscriptionData(
      organizationId,
      savedSubscription,
    );

    return savedSubscription;
  }

  // ==================== OBTENER SUSCRIPCIONES ====================

  /**
   * Obtener suscripción activa de una organización
   */
  async getActiveSubscription(
    organizationId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: {
        organizationId,
        status: SubscriptionStatus.ACTIVE,
        endDate: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Obtener todas las suscripciones de una organización
   */
  async getOrganizationSubscriptions(
    organizationId: string,
  ): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtener información detallada de suscripción para mostrar en frontend
   */
  async getSubscriptionInfo(organizationId: string) {
    const subscription = await this.getActiveSubscription(organizationId);
    if (subscription) return this.formatSubscriptionInfo(subscription);

    const latestSubscription = await this.subscriptionRepository.findOne({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    if (latestSubscription) return this.formatSubscriptionInfo(latestSubscription);

    const newTrial = await this.createTrialSubscription(organizationId);
    return this.formatSubscriptionInfo(newTrial);
  }

  private formatSubscriptionInfo(subscription: Subscription) {
    return {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      type: subscription.type,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      isActive: subscription.isActive,
      isExpired: subscription.isExpired,
      isTrial: subscription.isTrial,
      daysUntilExpiration: subscription.daysUntilExpiration,
      subscriptionProgress: subscription.subscriptionProgress,
      remainingDays: subscription.remainingDays,
      maxUsers: subscription.maxUsers,
      autoRenew: subscription.autoRenew,
      price: subscription.price,
      currency: subscription.currency,
      paymentMethod: subscription.paymentMethod,
      nextBillingDate: subscription.nextBillingDate,
      trialEndsAt: subscription.trialEndsAt,
      billingCycle: subscription.billingCycle,
    };
  }

  // ==================== GESTIONAR SUSCRIPCIONES ====================

  /**
   * Renovar suscripción
   */
  async renewSubscription(
    subscriptionId: string,
    durationMonths: number,
    price?: number,
  ): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId);

    const newEndDate = new Date(subscription.endDate);
    newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

    subscription.renew(newEndDate, price);

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Actualizar plan de suscripción
   */
  async upgradeSubscription(
    subscriptionId: string,
    newPlan: SubscriptionPlan,
    newPrice?: number,
  ): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId);

    subscription.upgrade(newPlan, newPrice);

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Cancelar suscripción
   */
  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
  ): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId);

    subscription.cancel(reason);

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Cancelar suscripción activa de una organización
   */
  async cancelActiveSubscription(
    organizationId: string,
    reason?: string,
  ): Promise<void> {
    const activeSubscription = await this.getActiveSubscription(organizationId);

    if (activeSubscription) {
      await this.cancelSubscription(activeSubscription.id, reason);
    }
  }

  /**
   * Suspender suscripción
   */
  async suspendSubscription(
    subscriptionId: string,
    reason?: string,
  ): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId);

    subscription.suspend(reason);

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Reactivar suscripción suspendida
   */
  async reactivateSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId);

    if (subscription.status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException(
        'Solo se pueden reactivar suscripciones suspendidas',
      );
    }

    subscription.activate();

    return this.subscriptionRepository.save(subscription);
  }

  // ==================== VALIDACIONES ====================

  /**
   * Verificar si una organización puede realizar una acción
   */
  async canPerformAction(
    organizationId: string,
    action: string,
  ): Promise<boolean> {
    const subscription = await this.getActiveSubscription(organizationId);

    if (!subscription) {
      return false;
    }

    return subscription.canPerformAction(action);
  }

  /**
   * Verificar límite de usuarios
   */
  async checkUserLimit(
    organizationId: string,
    currentUserCount: number,
  ): Promise<boolean> {
    const subscription = await this.getActiveSubscription(organizationId);

    if (!subscription) {
      return false;
    }

    return subscription.checkUserLimit(currentUserCount);
  }

  /**
   * Obtener límite máximo de usuarios para una organización
   */
  async getMaxUsers(organizationId: string): Promise<number> {
    const subscription = await this.getActiveSubscription(organizationId);

    if (!subscription) {
      return 0;
    }

    return subscription.maxUsers;
  }

  // ==================== TAREAS PROGRAMADAS ====================

  /**
   * Tarea programada para expirar suscripciones vencidas
   * Se ejecuta cada hora
   */
  @Cron('0 * * * *') // Cada hora
  async expireSubscriptions(): Promise<void> {
    console.log('🔄 Ejecutando tarea de expiración de suscripciones...');

    const expiredSubscriptions = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: LessThan(new Date()),
      },
    });

    for (const subscription of expiredSubscriptions) {
      subscription.expire();
      await this.subscriptionRepository.save(subscription);

      console.log(
        `⏰ Suscripción ${subscription.id} expirada para organización ${subscription.organizationId}`,
      );
    }

    console.log(
      `✅ Procesadas ${expiredSubscriptions.length} suscripciones expiradas`,
    );
  }

  /**
   * Tarea programada para procesar renovaciones automáticas
   * Se ejecuta diariamente a las 2 AM
   */
  @Cron('0 2 * * *') // Diario a las 2 AM
  async processAutoRenewals(): Promise<void> {
    console.log('🔄 Ejecutando tarea de renovaciones automáticas...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const subscriptionsToRenew = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        nextBillingDate: LessThan(tomorrow),
      },
    });

    for (const subscription of subscriptionsToRenew) {
      try {
        // En un sistema real, aquí se procesaría el pago
        // Por ahora, simplemente renovamos por el mismo período
        const durationMonths = subscription.billingCycle;
        if (durationMonths > 0) {
          await this.renewSubscription(subscription.id, durationMonths);
          console.log(
            `🔄 Suscripción ${subscription.id} renovada automáticamente`,
          );
        }
      } catch (error) {
        console.error(
          `❌ Error renovando suscripción ${subscription.id}:`,
          error,
        );
        // En caso de error, suspender la suscripción
        await this.suspendSubscription(
          subscription.id,
          'Error en renovación automática',
        );
      }
    }

    console.log(
      `✅ Procesadas ${subscriptionsToRenew.length} renovaciones automáticas`,
    );
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private async findById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
    }

    return subscription;
  }

  /**
   * Obtener estadísticas de suscripciones
   */
  async getSubscriptionStats() {
    const [
      totalActive,
      totalExpired,
      totalCancelled,
      totalTrial,
      totalBasic,
      totalPremium,
      totalEnterprise,
    ] = await Promise.all([
      this.subscriptionRepository.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.subscriptionRepository.count({
        where: { status: SubscriptionStatus.EXPIRED },
      }),
      this.subscriptionRepository.count({
        where: { status: SubscriptionStatus.CANCELLED },
      }),
      this.subscriptionRepository.count({
        where: { plan: SubscriptionPlan.TRIAL },
      }),
      this.subscriptionRepository.count({
        where: { plan: SubscriptionPlan.BASIC },
      }),
      this.subscriptionRepository.count({
        where: { plan: SubscriptionPlan.PREMIUM },
      }),
      this.subscriptionRepository.count({
        where: { plan: SubscriptionPlan.ENTERPRISE },
      }),
    ]);

    return {
      byStatus: {
        active: totalActive,
        expired: totalExpired,
        cancelled: totalCancelled,
      },
      byPlan: {
        trial: totalTrial,
        basic: totalBasic,
        premium: totalPremium,
        enterprise: totalEnterprise,
      },
      total: totalActive + totalExpired + totalCancelled,
    };
  }

  /**
   * Sincronizar todas las organizaciones existentes con sus suscripciones activas
   * Método de utilidad para migración/corrección de datos
   */
  async syncAllOrganizationsSubscriptionData(): Promise<void> {
    console.log(
      '🔄 Iniciando sincronización de datos de suscripción en todas las organizaciones...',
    );

    const organizations = await this.organizationRepository.find({
      where: { isActive: true },
    });

    let syncedCount = 0;
    let errorCount = 0;

    for (const organization of organizations) {
      try {
        const activeSubscription = await this.getActiveSubscription(
          organization.id,
        );

        if (activeSubscription) {
          await this.syncOrganizationSubscriptionData(
            organization.id,
            activeSubscription,
          );
          syncedCount++;
        } else {
          console.warn(
            `⚠️ Organización ${organization.name} no tiene suscripción activa`,
          );
        }
      } catch (error) {
        console.error(
          `❌ Error sincronizando organización ${organization.name}:`,
          error,
        );
        errorCount++;
      }
    }

    console.log(
      `✅ Sincronización completada: ${syncedCount} exitosas, ${errorCount} errores`,
    );
  }

  /**
   * Sincronizar datos de suscripción con campos deprecated en Organization
   * para mantener compatibilidad con código legacy
   */
  private async syncOrganizationSubscriptionData(
    organizationId: string,
    subscription: Subscription,
  ): Promise<void> {
    try {
      // Buscar la organización
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        console.warn(
          `⚠️ Organización ${organizationId} no encontrada para sincronizar datos de suscripción`,
        );
        return;
      }

      // Actualizar campos deprecated para compatibilidad
      await this.organizationRepository.update(organizationId, {
        subscriptionPlan: subscription.plan,
        subscriptionStatus: subscription.status,
        subscriptionStartDate: subscription.startDate,
        subscriptionEndDate: subscription.endDate,
        trialStartDate: subscription.isTrial ? subscription.startDate : null,
        trialEndDate: subscription.isTrial ? subscription.endDate : null,
      });

      console.log(
        `✅ Datos de suscripción sincronizados en Organization para ${organization.name}`,
      );
    } catch (error) {
      console.error(
        `❌ Error sincronizando datos de suscripción para organización ${organizationId}:`,
        error,
      );
      // No lanzar error para no fallar la creación de suscripción
    }
  }

  // ==================== MÉTODOS PARA ENDPOINTS DE LÍMITES Y USO ====================

  /**
   * Obtener suscripción actual con todos los detalles para el frontend
   */
  async getCurrentSubscriptionDto(
    organizationId: string,
  ): Promise<SubscriptionCurrentDto> {
    // 1. Suscripción activa y vigente
    const subscription = await this.getActiveSubscription(organizationId);
    console.log(`[SUB_DEBUG] orgId=${organizationId} activeSub=${subscription ? JSON.stringify({id: subscription.id, endDate: subscription.endDate, endDateType: typeof subscription.endDate, isExpired: subscription.isExpired, daysUntil: subscription.daysUntilExpiration}) : 'null'}`);
    if (subscription) return this.mapToCurrentDto(subscription);

    // 2. No hay activa — buscar cualquier suscripción existente (trial vencido, cancelada, etc.)
    const latestSubscription = await this.subscriptionRepository.findOne({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    if (latestSubscription) return this.mapToCurrentDto(latestSubscription);

    // 3. No existe ninguna — crear trial nuevo
    const newTrial = await this.createTrialSubscription(organizationId);
    return this.mapToCurrentDto(newTrial);
  }

  /**
   * Obtener límites del plan actual de la organización
   */
  async getSubscriptionLimits(
    organizationId: string,
  ): Promise<SubscriptionLimitsResponseDto> {
    const subscription = await this.getActiveSubscription(organizationId);
    const plan = subscription?.plan || SubscriptionPlan.TRIAL;
    const limits = getPlanLimits(plan);

    return {
      plan,
      planDisplayName: PLAN_DISPLAY_NAMES[plan],
      limits: this.mapToPlanLimitsDto(limits),
      isUnlimited: this.isPlanUnlimited(plan),
      allowedActions: this.getAllowedActions(limits),
      restrictedActions: this.getRestrictedActions(limits),
    };
  }

  /**
   * Obtener uso actual de recursos de la organización
   */
  async getSubscriptionUsage(
    organizationId: string,
    usageCounts: {
      products: number;
      customers: number;
      users: number;
      invoicesThisMonth: number;
      expensesThisMonth: number;
      storageMB: number;
    },
  ): Promise<SubscriptionUsageDto> {
    const subscription = await this.getActiveSubscription(organizationId);
    const plan = subscription?.plan || SubscriptionPlan.TRIAL;
    const limits = getPlanLimits(plan);
    const warnings: UsageWarningDto[] = [];

    // Helper para crear ResourceUsageDto
    const createResourceUsage = (
      current: number,
      limit: number,
      resourceName: string,
    ): ResourceUsageDto => {
      const unlimited = isUnlimited(limit);
      const percentage = getUsagePercentage(current, limit);
      const nearLimit = isNearLimit(current, limit);
      const reachedLimit = hasReachedLimit(current, limit);

      // Generar advertencias
      if (reachedLimit && !unlimited) {
        warnings.push({
          resource: resourceName,
          type: 'at_limit',
          message: `Has alcanzado el límite de ${resourceName}`,
          percentage: 100,
        });
      } else if (nearLimit && !unlimited) {
        warnings.push({
          resource: resourceName,
          type: 'near_limit',
          message: `Estás cerca del límite de ${resourceName} (${percentage}%)`,
          percentage,
        });
      }

      return {
        current,
        limit,
        isUnlimited: unlimited,
        percentage,
        isNearLimit: nearLimit,
        hasReachedLimit: reachedLimit,
      };
    };

    return {
      plan,
      planDisplayName: PLAN_DISPLAY_NAMES[plan],
      hasUnlimitedResources: this.isPlanUnlimited(plan),
      products: createResourceUsage(
        usageCounts.products,
        limits.maxProducts,
        'productos',
      ),
      customers: createResourceUsage(
        usageCounts.customers,
        limits.maxCustomers,
        'clientes',
      ),
      users: createResourceUsage(usageCounts.users, limits.maxUsers, 'usuarios'),
      invoicesThisMonth: createResourceUsage(
        usageCounts.invoicesThisMonth,
        limits.maxInvoicesPerMonth,
        'facturas mensuales',
      ),
      expensesThisMonth: createResourceUsage(
        usageCounts.expensesThisMonth,
        limits.maxExpensesPerMonth,
        'gastos mensuales',
      ),
      storage: createResourceUsage(
        usageCounts.storageMB,
        limits.maxStorageMB,
        'almacenamiento',
      ),
      warnings,
      daysUntilExpiration: subscription?.daysUntilExpiration ?? 0,
      nextRenewalDate: subscription?.nextBillingDate,
    };
  }

  /**
   * Validar si una acción puede ser realizada según el plan
   */
  async validateActionForPlan(
    organizationId: string,
    action: string,
    currentUsage?: number,
  ): Promise<ActionValidationDto> {
    const subscription = await this.getActiveSubscription(organizationId);

    if (!subscription) {
      return {
        allowed: false,
        reason: 'No hay suscripción activa',
        requiredPlan: SubscriptionPlan.TRIAL,
      };
    }

    if (!subscription.isActive) {
      return {
        allowed: false,
        reason: 'La suscripción ha expirado',
        requiredPlan: subscription.plan,
      };
    }

    const limits = getPlanLimits(subscription.plan);
    const features = limits.features;

    // Mapeo de acciones a características
    const actionFeatureMap: Record<string, keyof PlanFeatures> = {
      export_reports: 'canExportReports',
      export_pdf: 'canExportPdf',
      export_excel: 'canExportExcel',
      thermal_printer: 'canUseThermalPrinter',
      advanced_reports: 'canAccessAdvancedReports',
      multiple_warehouses: 'canUseMultipleWarehouses',
      api_integrations: 'canUseApiIntegrations',
      bulk_operations: 'canUseBulkOperations',
      custom_branding: 'canUseCustomBranding',
      audit_logs: 'canAccessAuditLogs',
      advanced_inventory: 'canUseAdvancedInventory',
      credit_notes: 'canUseCreditNotes',
      customer_credits: 'canUseCustomerCredits',
      purchase_orders: 'canUsePurchaseOrders',
      multiple_currencies: 'canUseMultipleCurrencies',
      advanced_pricing: 'canUseAdvancedPricing',
      schedule_reports: 'canScheduleReports',
      email_notifications: 'canUseEmailNotifications',
    };

    // Mapeo de acciones a límites
    const actionLimitMap: Record<string, keyof PlanLimits> = {
      create_product: 'maxProducts',
      create_customer: 'maxCustomers',
      create_invoice: 'maxInvoicesPerMonth',
      create_user: 'maxUsers',
      create_expense: 'maxExpensesPerMonth',
      upload_file: 'maxStorageMB',
    };

    // Verificar característica
    if (actionFeatureMap[action]) {
      const featureKey = actionFeatureMap[action];
      const isAllowed = features[featureKey];

      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Esta función no está disponible en tu plan ${PLAN_DISPLAY_NAMES[subscription.plan]}`,
          requiredPlan: this.getMinimumPlanForFeature(featureKey),
        };
      }
    }

    // Verificar límite
    if (actionLimitMap[action] && currentUsage !== undefined) {
      const limitKey = actionLimitMap[action];
      const limit = limits[limitKey] as number;

      if (!isUnlimited(limit) && currentUsage >= limit) {
        return {
          allowed: false,
          reason: `Has alcanzado el límite de ${limit} para tu plan`,
          requiredPlan: this.getNextPlan(subscription.plan),
          currentLimit: limit,
          currentUsage,
        };
      }
    }

    return { allowed: true };
  }

  // ==================== MÉTODOS AUXILIARES PARA DTOs ====================

  private mapToCurrentDto(subscription: Subscription): SubscriptionCurrentDto {
    const limits = getPlanLimits(subscription.plan);

    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      plan: subscription.plan,
      planDisplayName: PLAN_DISPLAY_NAMES[subscription.plan],
      status: subscription.status,
      type: subscription.type,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      isActive: subscription.isActive,
      isExpired: subscription.isExpired,
      isTrial: subscription.isTrial,
      daysUntilExpiration: subscription.daysUntilExpiration,
      subscriptionProgress: subscription.subscriptionProgress,
      remainingDays: subscription.remainingDays,
      maxUsers: subscription.maxUsers,
      autoRenew: subscription.autoRenew,
      price: subscription.price,
      currency: subscription.currency,
      paymentMethod: subscription.paymentMethod,
      nextBillingDate: subscription.nextBillingDate,
      trialEndsAt: subscription.trialEndsAt,
      billingCycle: subscription.billingCycle,
      limits: this.mapToPlanLimitsDto(limits),
    };
  }

  private mapToPlanLimitsDto(limits: PlanLimits): PlanLimitsDto {
    return {
      maxProducts: limits.maxProducts,
      maxCustomers: limits.maxCustomers,
      maxInvoicesPerMonth: limits.maxInvoicesPerMonth,
      maxUsers: limits.maxUsers,
      maxDevices: limits.maxDevices,
      maxStorageMB: limits.maxStorageMB,
      maxExpensesPerMonth: limits.maxExpensesPerMonth,
      maxCategoriesPerLevel: limits.maxCategoriesPerLevel,
      features: {
        canExportReports: limits.features.canExportReports,
        canExportPdf: limits.features.canExportPdf,
        canExportExcel: limits.features.canExportExcel,
        canUseThermalPrinter: limits.features.canUseThermalPrinter,
        canAccessAdvancedReports: limits.features.canAccessAdvancedReports,
        canUseMultipleWarehouses: limits.features.canUseMultipleWarehouses,
        canUseApiIntegrations: limits.features.canUseApiIntegrations,
        canUseBulkOperations: limits.features.canUseBulkOperations,
        canUseCustomBranding: limits.features.canUseCustomBranding,
        canAccessAuditLogs: limits.features.canAccessAuditLogs,
        canUseAdvancedInventory: limits.features.canUseAdvancedInventory,
        canUseCreditNotes: limits.features.canUseCreditNotes,
        canUseCustomerCredits: limits.features.canUseCustomerCredits,
        canUsePurchaseOrders: limits.features.canUsePurchaseOrders,
        canUseMultipleCurrencies: limits.features.canUseMultipleCurrencies,
        canUseAdvancedPricing: limits.features.canUseAdvancedPricing,
        canScheduleReports: limits.features.canScheduleReports,
        canUseEmailNotifications: limits.features.canUseEmailNotifications,
        prioritySupport: limits.features.prioritySupport,
      },
    };
  }

  private isPlanUnlimited(plan: SubscriptionPlan): boolean {
    return plan === SubscriptionPlan.ENTERPRISE;
  }

  private getAllowedActions(limits: PlanLimits): string[] {
    const actions: string[] = [];
    const features = limits.features;

    if (features.canExportReports) actions.push('export_reports');
    if (features.canExportPdf) actions.push('export_pdf');
    if (features.canExportExcel) actions.push('export_excel');
    if (features.canUseThermalPrinter) actions.push('thermal_printer');
    if (features.canAccessAdvancedReports) actions.push('advanced_reports');
    if (features.canUseMultipleWarehouses) actions.push('multiple_warehouses');
    if (features.canUseApiIntegrations) actions.push('api_integrations');
    if (features.canUseBulkOperations) actions.push('bulk_operations');
    if (features.canUseCustomBranding) actions.push('custom_branding');
    if (features.canAccessAuditLogs) actions.push('audit_logs');
    if (features.canUseAdvancedInventory) actions.push('advanced_inventory');
    if (features.canUseCreditNotes) actions.push('credit_notes');
    if (features.canUseCustomerCredits) actions.push('customer_credits');
    if (features.canUsePurchaseOrders) actions.push('purchase_orders');
    if (features.canUseMultipleCurrencies) actions.push('multiple_currencies');
    if (features.canUseAdvancedPricing) actions.push('advanced_pricing');
    if (features.canScheduleReports) actions.push('schedule_reports');
    if (features.canUseEmailNotifications) actions.push('email_notifications');

    return actions;
  }

  private getRestrictedActions(limits: PlanLimits): string[] {
    const allActions = [
      'export_reports',
      'export_pdf',
      'export_excel',
      'thermal_printer',
      'advanced_reports',
      'multiple_warehouses',
      'api_integrations',
      'bulk_operations',
      'custom_branding',
      'audit_logs',
      'advanced_inventory',
      'credit_notes',
      'customer_credits',
      'purchase_orders',
      'multiple_currencies',
      'advanced_pricing',
      'schedule_reports',
      'email_notifications',
    ];

    const allowedActions = this.getAllowedActions(limits);
    return allActions.filter((action) => !allowedActions.includes(action));
  }

  private getMinimumPlanForFeature(feature: keyof PlanFeatures): SubscriptionPlan {
    const planOrder = [
      SubscriptionPlan.TRIAL,
      SubscriptionPlan.BASIC,
      SubscriptionPlan.PREMIUM,
      SubscriptionPlan.ENTERPRISE,
    ];

    for (const plan of planOrder) {
      const limits = getPlanLimits(plan);
      if (limits.features[feature]) {
        return plan;
      }
    }

    return SubscriptionPlan.ENTERPRISE;
  }

  private getNextPlan(currentPlan: SubscriptionPlan): SubscriptionPlan {
    const planOrder = [
      SubscriptionPlan.TRIAL,
      SubscriptionPlan.BASIC,
      SubscriptionPlan.PREMIUM,
      SubscriptionPlan.ENTERPRISE,
    ];

    const currentIndex = planOrder.indexOf(currentPlan);
    if (currentIndex < planOrder.length - 1) {
      return planOrder[currentIndex + 1];
    }

    return SubscriptionPlan.ENTERPRISE;
  }
}
