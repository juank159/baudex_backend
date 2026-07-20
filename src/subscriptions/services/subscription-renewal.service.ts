// src/subscriptions/services/subscription-renewal.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
} from '../entities/subscription.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { RenewSubscriptionDto } from '../dto/renew-subscription.dto';

@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Renovar suscripción de una organización
   */
  async renewSubscription(renewData: RenewSubscriptionDto) {
    this.logger.log(
      `🔄 Iniciando renovación de suscripción para organización: ${renewData.organizationId}`,
    );

    // 1. Verificar que la organización existe
    const organization = await this.organizationRepository.findOne({
      where: { id: renewData.organizationId },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organización con ID ${renewData.organizationId} no encontrada`,
      );
    }

    this.logger.log(
      `✅ Organización encontrada: ${organization.name} (${organization.slug})`,
    );

    // 2. Buscar suscripciones actuales de la organización
    const currentSubscriptions = await this.subscriptionRepository.find({
      where: { organizationId: renewData.organizationId },
      order: { createdAt: 'DESC' },
    });

    this.logger.log(
      `📋 Suscripciones actuales encontradas: ${currentSubscriptions.length}`,
    );

    // 3. Marcar todas las suscripciones actuales como expiradas
    const expiredCount = await this.expireCurrentSubscriptions(
      renewData.organizationId,
    );
    this.logger.log(`⏰ ${expiredCount} suscripciones marcadas como expiradas`);

    // 4. Calcular fechas de la nueva suscripción
    const startDate = new Date();
    const endDate = renewData.endDate
      ? new Date(renewData.endDate)
      : (() => { const d = new Date(); d.setMonth(d.getMonth() + renewData.durationMonths); return d; })();

    // 5. Crear la nueva suscripción
    const newSubscription = this.subscriptionRepository.create({
      organizationId: renewData.organizationId,
      plan: renewData.plan as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
      trialEndsAt: renewData.plan === 'trial' ? endDate : null,
      price: renewData.price || this.getDefaultPrice(renewData.plan),
      currency: renewData.currency || 'USD',
      paymentMethod: renewData.paymentMethod || 'manual_renewal',
      autoRenew: false, // Por defecto false para renovaciones manuales
      isTrialUsed: renewData.plan !== 'trial', // Si no es trial, marca como usado
    });

    const savedSubscription =
      await this.subscriptionRepository.save(newSubscription);
    this.logger.log(`✅ Nueva suscripción creada: ${savedSubscription.id}`);

    // 6. Actualizar campos legacy en la organización
    await this.updateOrganizationLegacyFields(
      renewData.organizationId,
      renewData.plan,
      startDate,
      endDate,
    );

    this.logger.log(
      `🎉 Renovación completada exitosamente para organización: ${organization.name}`,
    );

    return {
      subscriptionId: savedSubscription.id,
      organizationId: renewData.organizationId,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      plan: renewData.plan,
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      durationMonths: renewData.durationMonths,
      price: newSubscription.price,
      currency: newSubscription.currency,
      previousSubscriptions: currentSubscriptions.length,
      expiredSubscriptions: expiredCount,
    };
  }

  /**
   * Marcar todas las suscripciones actuales como expiradas
   */
  private async expireCurrentSubscriptions(
    organizationId: string,
  ): Promise<number> {
    const result = await this.subscriptionRepository
      .createQueryBuilder()
      .update(Subscription)
      .set({
        status: SubscriptionStatus.EXPIRED,
        updatedAt: new Date(),
      })
      .where('organizationId = :organizationId', { organizationId })
      .andWhere('status != :expiredStatus', {
        expiredStatus: SubscriptionStatus.EXPIRED,
      })
      .execute();

    return result.affected || 0;
  }

  /**
   * Actualizar campos legacy en la tabla organizations
   */
  private async updateOrganizationLegacyFields(
    organizationId: string,
    plan: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    await this.organizationRepository
      .createQueryBuilder()
      .update(Organization)
      .set({
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        trialStartDate: null,
        trialEndDate: null,
        updatedAt: new Date(),
      })
      .where('id = :id', { id: organizationId })
      .execute();

    this.logger.log(`📝 Campos legacy actualizados en organizations`);
  }

  /**
   * Obtener precio por defecto según el plan
   */
  private getDefaultPrice(plan: string): number {
    const prices = {
      trial: 0,
      basic: 29.99,
      premium: 59.99,
      enterprise: 199.99,
    };

    return prices[plan] || 0;
  }

  /**
   * Obtener información detallada de suscripciones de una organización
   */
  async getOrganizationSubscriptionDetails(organizationId: string) {
    // Verificar que la organización existe
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organización con ID ${organizationId} no encontrada`,
      );
    }

    // Obtener todas las suscripciones
    const subscriptions = await this.subscriptionRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });

    // Obtener suscripción activa
    const activeSubscription = subscriptions.find(
      (sub) =>
        sub.status === SubscriptionStatus.ACTIVE && new Date() <= sub.endDate,
    );

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionStartDate:
          organization.subscriptionStartDate?.toISOString(),
        subscriptionEndDate: organization.subscriptionEndDate?.toISOString(),
      },
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.id,
            plan: activeSubscription.plan,
            status: activeSubscription.status,
            startDate: activeSubscription.startDate.toISOString(),
            endDate: activeSubscription.endDate.toISOString(),
            isExpired: new Date() > activeSubscription.endDate,
            daysUntilExpiration: Math.ceil(
              (activeSubscription.endDate.getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          }
        : null,
      allSubscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        startDate: sub.startDate.toISOString(),
        endDate: sub.endDate.toISOString(),
        createdAt: sub.createdAt.toISOString(),
      })),
      stats: {
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: subscriptions.filter(
          (sub) => sub.status === SubscriptionStatus.ACTIVE,
        ).length,
        expiredSubscriptions: subscriptions.filter(
          (sub) => sub.status === SubscriptionStatus.EXPIRED,
        ).length,
      },
    };
  }
}
