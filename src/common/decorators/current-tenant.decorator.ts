import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Organization } from '../../organizations/entities/organization.entity';

// Decorator para obtener información del tenant actual
export const CurrentTenant = createParamDecorator(
  (data: keyof Express.Request['tenant'] | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant) {
      return null;
    }

    if (data) {
      return tenant[data];
    }

    return tenant;
  },
);

// Decorator específico para obtener el ID del tenant
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant?.id || null;
  },
);

// Decorator específico para obtener la organización completa
export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Organization | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant?.organization || null;
  },
);

// Decorator específico para obtener el slug del tenant
export const TenantSlug = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant?.slug || null;
  },
);