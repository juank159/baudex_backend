// src/common/utils/tenant-clock.ts
import { AsyncLocalStorage } from 'async_hooks';
import {
  tenantDayEnd as dayEndIn,
  tenantDayStart as dayStartIn,
  parseClientDateTime,
  tenantRangeEnd,
  tenantRangeStart,
  toTenantCalendarDate,
  tenantDateParts,
  tenantDateString,
  tenantDayEnd,
  tenantDayStart,
  tenantMonthEnd,
  tenantMonthStart,
} from './timezone-range.util';

/** Zona usada cuando no hay un negocio en contexto (rutas públicas, arranque). */
export const FALLBACK_TIMEZONE = 'America/Bogota';

interface TenantClockStore {
  timezone: string;
}

const storage = new AsyncLocalStorage<TenantClockStore>();

/**
 * "Reloj del negocio" de la petición en curso.
 *
 * El servidor corre en UTC, así que `new Date().getDate()`, `CURRENT_DATE` o
 * `setHours(0, 0, 0, 0)` dan el día de Londres, no el del negocio: entre las
 * 7 u 8 de la noche y la medianoche, para el servidor ya es "mañana". Todo
 * cálculo de "hoy", "este mes" o "fin del día" debe salir de aquí.
 *
 * La zona se fija una vez por petición (ver `TenantClockMiddleware`) con la
 * configurada en el negocio, y queda disponible en cualquier parte del
 * código —servicios, entidades, generadores de números— sin tener que
 * pasarla como parámetro. Los trabajos programados deben envolver el
 * procesamiento de cada negocio con `runWithTenantTimezone`.
 */
export function runWithTenantTimezone<T>(timezone: string | null | undefined, fn: () => T): T {
  return storage.run({ timezone: timezone || FALLBACK_TIMEZONE }, fn);
}

/** Zona horaria del negocio en contexto. */
export function currentTenantTimezone(): string {
  return storage.getStore()?.timezone ?? FALLBACK_TIMEZONE;
}

/** Fecha de hoy en el negocio: `YYYY-MM-DD`. */
export function tenantToday(at: Date = new Date()): string {
  return tenantDateString(currentTenantTimezone(), at);
}

/** Año, mes (1-12) y día de hoy en el negocio. */
export function tenantNowParts(at: Date = new Date()): { year: number; month: number; day: number } {
  return tenantDateParts(currentTenantTimezone(), at);
}

/**
 * Fecha "de calendario" de hoy en el negocio, como Date a medianoche UTC.
 * Sus `getUTCFullYear()/getUTCMonth()/getUTCDate()` son el día del negocio.
 * Sirve para comparar contra columnas tipo `date` (que no tienen hora).
 */
export function tenantCalendarToday(at: Date = new Date()): Date {
  const { year, month, day } = tenantNowParts(at);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Primer instante de hoy en el negocio. */
export function tenantStartOfToday(at: Date = new Date()): Date {
  return tenantDayStart(tenantToday(at), currentTenantTimezone())!;
}

/** Último instante de hoy en el negocio. */
export function tenantEndOfToday(at: Date = new Date()): Date {
  return tenantDayEnd(tenantToday(at), currentTenantTimezone())!;
}

/** Último instante del día del negocio que cae `days` días después de hoy. */
export function tenantEndOfDayPlus(days: number, at: Date = new Date()): Date {
  const start = tenantStartOfToday(at);
  // Sumar días sobre el mediodía evita saltos por cambio de hora.
  const noonTarget = new Date(start.getTime() + 12 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000);
  return tenantDayEnd(tenantDateString(currentTenantTimezone(), noonTarget), currentTenantTimezone())!;
}

/** Inicio y fin del mes actual del negocio. */
export function tenantCurrentMonthRange(at: Date = new Date()): { start: Date; end: Date } {
  const timezone = currentTenantTimezone();
  return { start: tenantMonthStart(timezone, at), end: tenantMonthEnd(timezone, at) };
}

/** `YYYY` y `MM` del negocio, para numeración de documentos. */
export function tenantYearMonth(at: Date = new Date()): { year: number; month: string } {
  const { year, month } = tenantNowParts(at);
  return { year, month: String(month).padStart(2, '0') };
}

/**
 * "Ahora" según el reloj de pared del negocio, como un Date cuyos getters
 * normales (`getFullYear()`, `getMonth()`, `getDate()`, `getHours()`...) dan
 * la fecha y hora que marca el reloj del negocio, sin importar en qué zona
 * corra el servidor.
 *
 * Es el reemplazo directo de `new Date()` cuando lo que se quiere son las
 * PARTES del calendario (qué día/mes/año es hoy). No usarlo para guardar un
 * instante: para eso sigue siendo `new Date()`.
 */
export function tenantWallClockNow(at: Date = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: currentTenantTimezone(),
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const hour = get('hour') === 24 ? 0 : get('hour');
    return new Date(
      get('year'),
      get('month') - 1,
      get('day'),
      hour,
      get('minute'),
      get('second'),
      at.getMilliseconds(),
    );
  } catch {
    return at;
  }
}

/**
 * "Hoy" del negocio listo para usar dentro de SQL en vez de `CURRENT_DATE`
 * (que es el día del servidor en UTC). Devuelve p. ej. `'2026-10-13'::date`.
 * El valor sale de un formateo propio (solo dígitos y guiones), no de datos
 * del usuario.
 */
export function tenantTodaySql(at: Date = new Date()): string {
  const today = tenantToday(at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error(`Fecha del negocio inválida: ${today}`);
  }
  return `'${today}'::date`;
}

// ───────────── Fechas que manda la app, con la zona del negocio ─────────────

type ClientDate = string | Date | null | undefined;

/** Instante exacto de una fecha-hora del cliente (sin zona = reloj del negocio). */
export function tenantInstantOf(value: ClientDate): Date | null {
  return parseClientDateTime(value, currentTenantTimezone());
}

/** Día del negocio para guardar en una columna tipo `date`. */
export function tenantCalendarDateOf(value: ClientDate): Date | null {
  return toTenantCalendarDate(value, currentTenantTimezone());
}

/** Límite inferior de un filtro "desde" (solo fecha = inicio de ese día en el negocio). */
export function tenantRangeStartOf(value: ClientDate): Date | undefined {
  return tenantRangeStart(value, currentTenantTimezone()) ?? undefined;
}

/** Límite superior de un filtro "hasta" (solo fecha = fin de ese día en el negocio). */
export function tenantRangeEndOf(value: ClientDate): Date | undefined {
  return tenantRangeEnd(value, currentTenantTimezone()) ?? undefined;
}

/** Primer instante del día del negocio que contiene ese instante. */
export function tenantStartOfDayOf(instant: Date): Date {
  return dayStartIn(instant, currentTenantTimezone()) ?? instant;
}

/** Último instante del día del negocio que contiene ese instante. */
export function tenantEndOfDayOf(instant: Date): Date {
  return dayEndIn(instant, currentTenantTimezone()) ?? instant;
}

