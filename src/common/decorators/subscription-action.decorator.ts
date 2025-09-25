import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_ACTION_KEY = 'subscription_action';

/**
 * Decorator para marcar que un endpoint requiere verificación de suscripción
 * @param action - La acción que se está intentando realizar
 */
export const RequireSubscription = (action: string) =>
  SetMetadata(SUBSCRIPTION_ACTION_KEY, action);
