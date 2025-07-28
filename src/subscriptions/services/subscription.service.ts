import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionType,
} from '../entities/subscription.entity';
import { Organization } from '../../organizations/entities/organization.entity';

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
      throw new ConflictException('La organización ya tiene un período de prueba');
    }

    const subscription = Subscription.createTrial(organizationId);
    return this.subscriptionRepository.save(subscription);
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

    return this.subscriptionRepository.save(subscription);
  }

  // ==================== OBTENER SUSCRIPCIONES ====================

  /**
   * Obtener suscripción activa de una organización
   */
  async getActiveSubscription(organizationId: string): Promise<Subscription | null> {
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
  async getOrganizationSubscriptions(organizationId: string): Promise<Subscription[]> {
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
    
    if (!subscription) {
      // Si no hay suscripción activa, crear trial automáticamente
      const newTrial = await this.createTrialSubscription(organizationId);
      return this.formatSubscriptionInfo(newTrial);
    }

    return this.formatSubscriptionInfo(subscription);
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
      throw new BadRequestException('Solo se pueden reactivar suscripciones suspendidas');
    }
    
    subscription.activate();
    
    return this.subscriptionRepository.save(subscription);
  }

  // ==================== VALIDACIONES ====================

  /**
   * Verificar si una organización puede realizar una acción
   */
  async canPerformAction(organizationId: string, action: string): Promise<boolean> {
    const subscription = await this.getActiveSubscription(organizationId);
    
    if (!subscription) {
      return false;
    }
    
    return subscription.canPerformAction(action);
  }

  /**
   * Verificar límite de usuarios
   */
  async checkUserLimit(organizationId: string, currentUserCount: number): Promise<boolean> {
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
      
      console.log(`⏰ Suscripción ${subscription.id} expirada para organización ${subscription.organizationId}`);
    }

    console.log(`✅ Procesadas ${expiredSubscriptions.length} suscripciones expiradas`);
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
          console.log(`🔄 Suscripción ${subscription.id} renovada automáticamente`);
        }
      } catch (error) {
        console.error(`❌ Error renovando suscripción ${subscription.id}:`, error);
        // En caso de error, suspender la suscripción
        await this.suspendSubscription(subscription.id, 'Error en renovación automática');
      }
    }

    console.log(`✅ Procesadas ${subscriptionsToRenew.length} renovaciones automáticas`);
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
      this.subscriptionRepository.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.subscriptionRepository.count({ where: { status: SubscriptionStatus.EXPIRED } }),
      this.subscriptionRepository.count({ where: { status: SubscriptionStatus.CANCELLED } }),
      this.subscriptionRepository.count({ where: { plan: SubscriptionPlan.TRIAL } }),
      this.subscriptionRepository.count({ where: { plan: SubscriptionPlan.BASIC } }),
      this.subscriptionRepository.count({ where: { plan: SubscriptionPlan.PREMIUM } }),
      this.subscriptionRepository.count({ where: { plan: SubscriptionPlan.ENTERPRISE } }),
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
}