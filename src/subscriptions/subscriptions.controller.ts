import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SubscriptionService } from './services/subscription.service';

@ApiTags('Suscripciones')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('test/:organizationId')
  @ApiOperation({
    summary: 'Obtener información de suscripción (ENDPOINT DE PRUEBA)',
  })
  @ApiParam({ name: 'organizationId', description: 'ID de la organización' })
  async getSubscriptionTest(@Param('organizationId') organizationId: string) {
    try {
      // Obtener suscripción activa (puede ser null si está expirada)
      const activeSubscription =
        await this.subscriptionService.getActiveSubscription(organizationId);

      // Obtener todas las suscripciones de la organización
      const allSubscriptions =
        await this.subscriptionService.getOrganizationSubscriptions(
          organizationId,
        );

      // Probar capacidades
      const canCreateProduct = await this.subscriptionService.canPerformAction(
        organizationId,
        'create_product',
      );
      const canCreateUser = await this.subscriptionService.canPerformAction(
        organizationId,
        'create_user',
      );
      const userLimitCheck = await this.subscriptionService.checkUserLimit(
        organizationId,
        3,
      );
      const maxUsers =
        await this.subscriptionService.getMaxUsers(organizationId);

      return {
        organizationId,
        active_subscription: activeSubscription,
        all_subscriptions: allSubscriptions,
        permissions: {
          can_create_product: canCreateProduct,
          can_create_user: canCreateUser,
          user_limit_check_for_3_users: userLimitCheck,
          max_users: maxUsers,
        },
        subscription_analysis: {
          has_active_subscription: activeSubscription !== null,
          total_subscriptions: allSubscriptions.length,
          latest_subscription: allSubscriptions[0] || null,
        },
      };
    } catch (error) {
      return {
        error: error.message,
        organizationId,
      };
    }
  }
}
