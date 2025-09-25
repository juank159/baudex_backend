// src/subscriptions/services/subscription-expiration.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
} from '../entities/subscription.entity';

@Injectable()
export class SubscriptionExpirationService {
  private readonly logger = new Logger(SubscriptionExpirationService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  /**
   * Job que se ejecuta todos los días a las 00:30 AM
   * Actualiza automáticamente las suscripciones que han expirado
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionExpiration() {
    this.logger.log('🔄 Iniciando job de expiración de suscripciones...');

    try {
      const now = new Date();

      // Buscar suscripciones que están activas pero ya vencieron
      const expiredSubscriptions = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .where('subscription.status = :status', {
          status: SubscriptionStatus.ACTIVE,
        })
        .andWhere('subscription.endDate < :now', { now })
        .andWhere('subscription.isActive = :isActive', { isActive: true })
        .getMany();

      this.logger.log(
        `📋 Encontradas ${expiredSubscriptions.length} suscripciones expiradas`,
      );

      if (expiredSubscriptions.length === 0) {
        this.logger.log('✅ No hay suscripciones para expirar');
        return;
      }

      // Actualizar las suscripciones expiradas
      const result = await this.subscriptionRepository
        .createQueryBuilder()
        .update(Subscription)
        .set({
          status: SubscriptionStatus.EXPIRED,
          isActive: false,
          updatedAt: now,
        })
        .where('status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('endDate < :now', { now })
        .andWhere('isActive = :isActive', { isActive: true })
        .execute();

      this.logger.log(
        `✅ ${result.affected} suscripciones actualizadas a estado EXPIRED`,
      );

      // Log detallado de cada suscripción expirada
      for (const subscription of expiredSubscriptions) {
        this.logger.log(
          `📝 Suscripción expirada: ${subscription.id} - Plan: ${subscription.plan} - Org: ${subscription.organizationId} - Vencida el: ${subscription.endDate.toISOString()}`,
        );
      }

      this.logger.log('🎉 Job de expiración completado exitosamente');
    } catch (error) {
      this.logger.error(
        '❌ Error en job de expiración de suscripciones:',
        error,
      );
      this.logger.error(error.stack);
    }
  }

  /**
   * Job adicional que se ejecuta cada hora para verificar suscripciones de trial
   * que están por vencer en las próximas 24 horas
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleTrialWarnings() {
    this.logger.log('⚠️ Verificando trials que vencen pronto...');

    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas desde ahora

      const expiringTrials = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .where('subscription.plan = :plan', { plan: 'trial' })
        .andWhere('subscription.status = :status', {
          status: SubscriptionStatus.ACTIVE,
        })
        .andWhere('subscription.isActive = :isActive', { isActive: true })
        .andWhere('subscription.endDate BETWEEN :now AND :tomorrow', {
          now,
          tomorrow,
        })
        .getMany();

      if (expiringTrials.length > 0) {
        this.logger.warn(
          `⚠️ ${expiringTrials.length} trials vencen en las próximas 24 horas:`,
        );

        for (const trial of expiringTrials) {
          this.logger.warn(
            `📋 Trial por vencer: ${trial.id} - Org: ${trial.organizationId} - Vence: ${trial.endDate.toISOString()}`,
          );
        }
      } else {
        this.logger.log('✅ No hay trials por vencer en las próximas 24 horas');
      }
    } catch (error) {
      this.logger.error('❌ Error verificando trials por vencer:', error);
    }
  }

  /**
   * Método manual para forzar la actualización de suscripciones expiradas
   * Útil para testing o ejecución manual
   */
  async forceExpireSubscriptions(): Promise<{
    affected: number;
    subscriptions: Subscription[];
  }> {
    this.logger.log('🔧 Forzando expiración manual de suscripciones...');

    const now = new Date();

    // Buscar suscripciones expiradas
    const expiredSubscriptions = await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .where('subscription.status = :status', {
        status: SubscriptionStatus.ACTIVE,
      })
      .andWhere('subscription.endDate < :now', { now })
      .andWhere('subscription.isActive = :isActive', { isActive: true })
      .getMany();

    // Actualizar
    const result = await this.subscriptionRepository
      .createQueryBuilder()
      .update(Subscription)
      .set({
        status: SubscriptionStatus.EXPIRED,
        isActive: false,
        updatedAt: now,
      })
      .where('status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('endDate < :now', { now })
      .andWhere('isActive = :isActive', { isActive: true })
      .execute();

    this.logger.log(
      `✅ Expiración manual completada: ${result.affected} suscripciones actualizadas`,
    );

    return {
      affected: result.affected || 0,
      subscriptions: expiredSubscriptions,
    };
  }

  /**
   * Obtener estadísticas de suscripciones
   */
  async getSubscriptionStats() {
    const stats = await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .select([
        'subscription.status as status',
        'subscription.plan as plan',
        'COUNT(*) as count',
      ])
      .where('subscription.isActive = :isActive', { isActive: true })
      .groupBy('subscription.status, subscription.plan')
      .getRawMany();

    const expiredButActive = await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .where('subscription.status = :status', {
        status: SubscriptionStatus.ACTIVE,
      })
      .andWhere('subscription.endDate < :now', { now: new Date() })
      .andWhere('subscription.isActive = :isActive', { isActive: true })
      .getCount();

    return {
      stats,
      expiredButActive,
    };
  }
}
