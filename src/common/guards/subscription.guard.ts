import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantAwareService } from '../services/tenant-aware.service';
import { SUBSCRIPTION_ACTION_KEY } from '../decorators/subscription-action.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

export interface SubscriptionErrorResponse {
  error:
    | 'SUBSCRIPTION_EXPIRED'
    | 'SUBSCRIPTION_INACTIVE'
    | 'PLAN_LIMIT_EXCEEDED';
  message: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  trialEndDate?: Date;
  subscriptionEndDate?: Date;
  daysUntilExpiration?: number;
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenantService: TenantAwareService,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<string>(
      SUBSCRIPTION_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay acción definida, permitir el acceso
    if (!action) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = this.tenantService.getTenantId();

    if (!tenantId) {
      throw new UnauthorizedException('No se pudo determinar la organización');
    }

    // Obtener la organización con información de suscripción
    const organization = await this.organizationRepository.findOne({
      where: { id: tenantId },
      relations: ['subscriptions'],
    });

    if (!organization) {
      throw new UnauthorizedException('Organización no encontrada');
    }

    // Verificar si la organización puede realizar la acción usando la nueva lógica
    const currentSubscription = organization.currentSubscription;
    if (!currentSubscription || !currentSubscription.canPerformAction(action)) {
      const errorResponse: SubscriptionErrorResponse = {
        error: currentSubscription?.isExpired
          ? 'SUBSCRIPTION_EXPIRED'
          : 'SUBSCRIPTION_INACTIVE',
        message: this.getSubscriptionErrorMessage(
          organization,
          action,
          currentSubscription,
        ),
        subscriptionPlan:
          currentSubscription?.plan || organization.subscriptionPlan,
        subscriptionStatus:
          currentSubscription?.status || organization.subscriptionStatus,
        trialEndDate:
          currentSubscription?.trialEndsAt || organization.trialEndDate,
        subscriptionEndDate:
          currentSubscription?.endDate || organization.subscriptionEndDate,
        daysUntilExpiration:
          currentSubscription?.daysUntilExpiration ||
          organization.daysUntilExpiration,
      };

      throw new ForbiddenException(errorResponse);
    }

    // Agregar información de suscripción al request para uso posterior
    request.subscription = {
      plan: currentSubscription?.plan || organization.subscriptionPlan,
      status: currentSubscription?.status || organization.subscriptionStatus,
      daysUntilExpiration:
        currentSubscription?.daysUntilExpiration ||
        organization.daysUntilExpiration,
      isTrialExpired:
        currentSubscription?.isExpired || organization.isTrialExpired,
    };

    return true;
  }

  private getSubscriptionErrorMessage(
    organization: Organization,
    action: string,
    subscription?: Subscription,
  ): string {
    if (!subscription) {
      return `No tienes una suscripción activa. Para continuar ${this.getActionName(action)}, necesitas activar una suscripción.`;
    }

    if (subscription.isExpired) {
      return `Tu suscripción ha expirado. Para continuar ${this.getActionName(action)}, necesitas renovar tu suscripción.`;
    }

    if (!subscription.isActive) {
      return `Tu suscripción no está activa. Para continuar ${this.getActionName(action)}, necesitas activar tu suscripción.`;
    }

    return `No tienes permisos para realizar esta acción: ${this.getActionName(action)}`;
  }

  private getActionName(action: string): string {
    const actionNames = {
      create_product: 'creando productos',
      update_product: 'actualizando productos',
      delete_product: 'eliminando productos',
      create_customer: 'creando clientes',
      update_customer: 'actualizando clientes',
      delete_customer: 'eliminando clientes',
      create_invoice: 'creando facturas',
      update_invoice: 'actualizando facturas',
      delete_invoice: 'eliminando facturas',
      create_expense: 'creando gastos',
      update_expense: 'actualizando gastos',
      delete_expense: 'eliminando gastos',
      create_category: 'creando categorías',
      update_category: 'actualizando categorías',
      delete_category: 'eliminando categorías',
      update_organization: 'actualizando la organización',
      create_user: 'creando usuarios',
      update_user: 'actualizando usuarios',
      delete_user: 'eliminando usuarios',
    };

    return actionNames[action] || action;
  }
}
