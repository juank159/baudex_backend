import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

export interface SubscriptionErrorResponse {
  error: 'SUBSCRIPTION_EXPIRED' | 'SUBSCRIPTION_INACTIVE' | 'PLAN_LIMIT_EXCEEDED';
  message: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  trialEndDate?: Date;
  subscriptionEndDate?: Date;
  daysUntilExpiration?: number;
}

@Injectable()
export class SubscriptionCheckService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async checkSubscription(organizationId: string, action: string): Promise<void> {
    if (!organizationId) {
      return; // Si no hay organizationId, permitir (para casos especiales)
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new ForbiddenException('Organización no encontrada');
    }

    // Verificar si la organización puede realizar la acción
    if (!organization.canPerformAction(action)) {
      const errorResponse: SubscriptionErrorResponse = {
        error: organization.isTrialExpired 
          ? 'SUBSCRIPTION_EXPIRED' 
          : 'SUBSCRIPTION_INACTIVE',
        message: this.getSubscriptionErrorMessage(organization, action),
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        trialEndDate: organization.trialEndDate,
        subscriptionEndDate: organization.subscriptionEndDate,
        daysUntilExpiration: organization.daysUntilExpiration,
      };

      throw new ForbiddenException(errorResponse);
    }
  }

  private getSubscriptionErrorMessage(
    organization: Organization,
    action: string,
  ): string {
    if (organization.isTrialExpired) {
      return `Tu período de prueba ha expirado. Para continuar ${this.getActionName(action)}, necesitas actualizar tu plan de suscripción.`;
    }

    if (!organization.hasValidSubscription) {
      return `Tu suscripción no está activa. Para continuar ${this.getActionName(action)}, necesitas renovar tu suscripción.`;
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