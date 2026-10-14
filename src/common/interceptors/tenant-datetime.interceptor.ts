// src/common/interceptors/tenant-datetime.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { TenantTimezoneService } from '../services/tenant-timezone.service';
import {
  dateOnlyAtTenantNoon,
  isDateOnlyString,
  isNaiveDateTimeString,
  isRangeBoundaryKey,
  withTenantOffset,
} from '../utils/timezone-range.util';

/** Profundidad máxima al recorrer el cuerpo de la petición. */
const MAX_DEPTH = 8;

/**
 * Regla global: toda hora que llega SIN zona horaria es la hora del reloj del
 * negocio, y se interpreta con la zona configurada del tenant.
 *
 * Antes de que el controlador vea la petición, este interceptor recorre el
 * cuerpo y los parámetros de consulta, y a cada texto con forma de fecha-hora
 * sin zona (`2026-10-13T08:22:11.243`) le agrega el desfase del negocio
 * (`2026-10-13T08:22:11.243-04:00`), sin cambiar lo que marca el reloj.
 *
 * Con eso, TODOS los módulos —los actuales y los que se agreguen— obtienen el
 * instante correcto al convertir ese texto en fecha, sin depender de que cada
 * uno recuerde aplicar la zona. Lo que ya trae zona (`Z` o `±hh:mm`) no se
 * toca. Las fechas sin hora del cuerpo pasan al mediodía de ese día en el
 * negocio (ver `converted`).
 */
@Injectable()
export class TenantDateTimeInterceptor implements NestInterceptor {
  constructor(private readonly tenantTimezone: TenantTimezoneService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const hasBody = req.body && typeof req.body === 'object';
    const hasQuery = req.query && typeof req.query === 'object';
    if (!hasBody && !hasQuery) return next.handle();
    if (!this.needsRewrite(req.body, true, 0) && !this.needsRewrite(req.query, false, 0)) {
      return next.handle();
    }

    const organizationId: string | undefined = req.tenant?.id ?? req.user?.organizationId;
    const knownTimezone: string | undefined = req.tenant?.organization?.timezone;

    const resolveTimezone = knownTimezone && organizationId
      ? Promise.resolve(this.tenantTimezone.remember(organizationId, knownTimezone))
      : this.tenantTimezone.forOrganization(organizationId);

    return from(resolveTimezone).pipe(
      mergeMap((timezone) => {
        if (hasBody) this.rewrite(req.body, timezone, true, 0);
        if (hasQuery) this.rewrite(req.query, timezone, false, 0);
        return next.handle();
      }),
    );
  }

  /**
   * Valor ya con la zona del negocio, o `undefined` si no hay que tocarlo.
   *
   * - Fecha-hora sin zona → se le agrega el desfase del negocio (en cuerpo y
   *   en parámetros de consulta).
   * - Fecha sola → solo en el CUERPO, y solo si el campo no es el límite de
   *   un rango: pasa a ser el mediodía de ese día en el negocio. Los límites
   *   de rango (`startDate`, `endDate`, `dateFrom`...) se dejan como fecha
   *   para que cada consulta los resuelva como inicio/fin de día del negocio.
   */
  private converted(key: string | null, value: any, timezone: string, isBody: boolean): string | undefined {
    if (isNaiveDateTimeString(value)) return withTenantOffset(value, timezone);
    if (isBody && isDateOnlyString(value) && !(key && isRangeBoundaryKey(key))) {
      return dateOnlyAtTenantNoon(value, timezone);
    }
    return undefined;
  }

  private needsRewrite(node: any, isBody: boolean, depth: number, key: string | null = null): boolean {
    if (node === null || node === undefined || depth > MAX_DEPTH) return false;
    if (typeof node === 'string') {
      return (
        isNaiveDateTimeString(node) ||
        (isBody && isDateOnlyString(node) && !(key && isRangeBoundaryKey(key)))
      );
    }
    if (Array.isArray(node)) {
      return node.some((item) => this.needsRewrite(item, isBody, depth + 1, key));
    }
    if (typeof node === 'object' && this.isPlainContainer(node)) {
      return Object.keys(node).some((k) => this.needsRewrite(node[k], isBody, depth + 1, k));
    }
    return false;
  }

  /** Reescribe en el mismo objeto los textos de fecha sin zona. */
  private rewrite(node: any, timezone: string, isBody: boolean, depth: number, parentKey: string | null = null): void {
    if (node === null || node === undefined || depth > MAX_DEPTH) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const next = this.converted(parentKey, node[i], timezone, isBody);
        if (next !== undefined) node[i] = next;
        else this.rewrite(node[i], timezone, isBody, depth + 1, parentKey);
      }
      return;
    }
    if (typeof node === 'object' && this.isPlainContainer(node)) {
      for (const key of Object.keys(node)) {
        const next = this.converted(key, node[key], timezone, isBody);
        if (next !== undefined) node[key] = next;
        else this.rewrite(node[key], timezone, isBody, depth + 1, key);
      }
    }
  }

  /** Solo objetos de datos (no Buffers, archivos subidos ni Date). */
  private isPlainContainer(node: any): boolean {
    if (node instanceof Date || Buffer.isBuffer(node)) return false;
    const proto = Object.getPrototypeOf(node);
    return proto === null || proto === Object.prototype;
  }
}
