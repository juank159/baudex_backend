// src/common/services/tenant-timezone.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Zona usada solo si un negocio no tiene ninguna configurada. */
export const DEFAULT_TENANT_TIMEZONE = 'America/Bogota';

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Zona horaria configurada de cada negocio (`organizations.timezone`).
 *
 * Es la fuente única para cualquier cálculo de fechas en el servidor: qué
 * día es "hoy" para el negocio, dónde empieza y termina un día, y en qué
 * zona está una hora que llegó sin zona. Guarda el valor en memoria unos
 * minutos para no consultar la base en cada petición.
 */
@Injectable()
export class TenantTimezoneService {
  private readonly logger = new Logger('TenantTimezone');
  private readonly cache = new Map<string, { timezone: string; at: number }>();

  // Servicio único (no por petición) para que la caché sirva entre peticiones.
  constructor(private readonly dataSource: DataSource) {}

  /** Zona horaria del negocio indicado. */
  async forOrganization(organizationId: string | null | undefined): Promise<string> {
    if (!organizationId) return DEFAULT_TENANT_TIMEZONE;

    const cached = this.cache.get(organizationId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.timezone;

    try {
      const rows: { timezone: string | null }[] = await this.dataSource.query(
        `SELECT timezone FROM organizations WHERE id = $1`,
        [organizationId],
      );
      const timezone = this.validOrDefault(rows?.[0]?.timezone);
      this.cache.set(organizationId, { timezone, at: Date.now() });
      return timezone;
    } catch (error) {
      this.logger.error(`No se pudo leer la zona horaria del negocio ${organizationId}: ${error?.message}`);
      return cached?.timezone ?? DEFAULT_TENANT_TIMEZONE;
    }
  }

  /** Al cambiar la configuración del negocio, olvidar el valor guardado. */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }

  /** Recuerda una zona ya conocida (p. ej. la que trae el tenant de la petición). */
  remember(organizationId: string, timezone: string | null | undefined): string {
    const valid = this.validOrDefault(timezone);
    this.cache.set(organizationId, { timezone: valid, at: Date.now() });
    return valid;
  }

  private validOrDefault(timezone: string | null | undefined): string {
    if (!timezone) return DEFAULT_TENANT_TIMEZONE;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return timezone;
    } catch {
      this.logger.warn(`Zona horaria inválida "${timezone}", se usa ${DEFAULT_TENANT_TIMEZONE}`);
      return DEFAULT_TENANT_TIMEZONE;
    }
  }
}
