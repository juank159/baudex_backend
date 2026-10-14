// src/common/middlewares/tenant-clock.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantTimezoneService } from '../services/tenant-timezone.service';
import { runWithTenantTimezone } from '../utils/tenant-clock';

/**
 * Fija el "reloj del negocio" para toda la petición: a partir de aquí,
 * cualquier código puede preguntar qué día es hoy para ESE negocio
 * (`tenantToday()`, `tenantNowParts()`, etc.) usando la zona horaria
 * configurada en el tenant. Debe ir después de `TenantMiddleware`.
 */
@Injectable()
export class TenantClockMiddleware implements NestMiddleware {
  constructor(private readonly tenantTimezone: TenantTimezoneService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const tenant: any = (req as any).tenant;
    let timezone: string;
    try {
      timezone = tenant?.id
        ? tenant.organization?.timezone
          ? this.tenantTimezone.remember(tenant.id, tenant.organization.timezone)
          : await this.tenantTimezone.forOrganization(tenant.id)
        : await this.tenantTimezone.forOrganization(null);
    } catch {
      timezone = await this.tenantTimezone.forOrganization(null);
    }
    runWithTenantTimezone(timezone, () => next());
  }
}
