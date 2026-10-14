/**
 * Convierte una fecha local (YYYY-MM-DD en una TZ dada) a un timestamp UTC
 * que representa la medianoche de ese día en la TZ del tenant.
 *
 * Ej: '2026-04-19' en 'America/Bogota' → 2026-04-19T05:00:00Z
 *     '2026-04-19' en 'America/Caracas' → 2026-04-19T04:00:00Z
 *
 * Se usa para construir rangos de timestamp tz-aware que aprovechan índices
 * btree sin caer en filter por expresión funcional (`::date AT TIME ZONE ...`).
 */
export function toUtcAtTenantMidnight(dateStr: string, tenantTimezone: string): Date {
  // Usar Z para que Date siempre interprete como UTC puro,
  // independientemente del TZ del proceso Node.js en producción.
  const asUtcMidnight = new Date(`${dateStr}T00:00:00Z`);
  const tzOffsetMs = getTimezoneOffsetMs(asUtcMidnight, tenantTimezone);
  return new Date(asUtcMidnight.getTime() - tzOffsetMs);
}

/**
 * Interpreta una fecha/hora enviada por la app.
 *
 * - Si trae zona horaria explícita (`...Z` o `...+05:00`), se respeta tal cual.
 * - Si NO trae zona (ej. `2026-10-13T08:22:11.243`), es la hora del RELOJ DEL
 *   NEGOCIO: se interpreta en la zona horaria del tenant. Antes se tomaba como
 *   UTC y el pago quedaba guardado varias horas antes de la hora real (4 h en
 *   Caracas, 5 h en Bogotá); por eso la caja dejaba por fuera abonos hechos
 *   poco después de abrir el turno.
 * - Si es solo fecha (`2026-10-13`), se toma el mediodía de ese día en la zona
 *   del tenant, para que nunca "se pase" al día anterior.
 *
 * Devuelve `null` si el valor no es una fecha válida.
 */
export function parseClientDateTime(
  value: string | Date | null | undefined,
  tenantTimezone: string,
): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  const hasExplicitZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (hasExplicitZone) {
    const explicit = new Date(text);
    return isNaN(explicit.getTime()) ? null : explicit;
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const wallClock = dateOnly ? `${text}T12:00:00` : text.replace(' ', 'T');

  // Leer el reloj de pared como si fuera UTC y restarle el desfase del tenant.
  const asUtc = new Date(`${wallClock}Z`);
  if (isNaN(asUtc.getTime())) return null;
  try {
    // Los desfases horarios son minutos enteros: redondear evita arrastrar
    // los milisegundos de la hora al cálculo.
    const offsetAt = (instant: Date) =>
      Math.round(getTimezoneOffsetMs(instant, tenantTimezone) / 60000) * 60000;
    const firstGuess = new Date(asUtc.getTime() - offsetAt(asUtc));
    // Segundo paso por si el desfase cambia justo en ese instante (horario de verano).
    return new Date(asUtc.getTime() - offsetAt(firstGuess));
  } catch {
    return asUtc;
  }
}

/**
 * La misma fecha interpretada "a la antigua" (sin zona = UTC). Solo se usa
 * para reconocer registros guardados antes de la corrección.
 */
export function parseClientDateTimeLegacy(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  // Antes de la corrección, la hora sin zona se guardaba tomando lo que
  // marcaba el reloj como si fuera UTC. Se reconstruye ese mismo valor a
  // partir del reloj de pared, venga el texto sin zona o ya con desfase.
  const wall = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,9})?)(?:[+-]\d{2}:?\d{2})?$/.exec(text);
  const legacy = wall ? new Date(`${wall[1].replace(' ', 'T')}Z`) : new Date(text);
  return isNaN(legacy.getTime()) ? null : legacy;
}

/** Retorna un Date un día después del timestamp recibido (para `< endExclusive`). */
export function addOneDay(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Retorna la hora local (0-23) según la timezone dada. Se usa en los
 * cronjobs multi-tenant: el cron dispara cada hora UTC, y el handler
 * filtra qué tenants deben procesarse comparando su hora local vs la
 * hora objetivo (ej. 8am local).
 *
 * Ej: a las 13:00 UTC, getHourInTimezone('America/Bogota') → 8.
 *     a las 17:00 UTC, getHourInTimezone('America/Caracas') → 13.
 */
export function getHourInTimezone(timezone: string, at: Date = new Date()): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(at);
    const n = parseInt(formatted, 10);
    // Algunos runtimes retornan "24" para medianoche; normalizamos a 0.
    return Number.isFinite(n) ? (n === 24 ? 0 : n) : 0;
  } catch {
    return 0;
  }
}

/** Retorna el día de la semana local (0=domingo, 6=sábado) en la TZ dada. */
export function getWeekdayInTimezone(timezone: string, at: Date = new Date()): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(at);
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return map[name] ?? 0;
  } catch {
    return 0;
  }
}

/** Milisegundos de offset entre UTC y la TZ dada para una fecha concreta. */
function getTimezoneOffsetMs(utcDate: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(utcDate)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - utcDate.getTime();
}

// ───────────────────────── Zona horaria del tenant ─────────────────────────
// Regla del sistema: TODA fecha/hora se interpreta, se guarda y se filtra con
// la zona horaria configurada del negocio (`organizations.timezone`). El
// servidor corre en UTC; estas funciones son la única forma correcta de
// pasar entre "el reloj del negocio" e instantes reales.

/** Texto con fecha y hora pero SIN zona: `2026-10-13T08:22:11.243` */
const NAIVE_DATETIME =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?(\.\d{1,9})?$/;

/** Texto con solo fecha: `2026-10-13` */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isNaiveDateTimeString(value: unknown): value is string {
  return typeof value === 'string' && NAIVE_DATETIME.test(value.trim());
}

export function isDateOnlyString(value: unknown): value is string {
  return typeof value === 'string' && DATE_ONLY.test(value.trim());
}

/** Desfase del tenant respecto a UTC en ese instante, como `-04:00`. */
export function tenantOffsetLabel(instant: Date, tenantTimezone: string): string {
  const offsetMin = Math.round(getTimezoneOffsetMs(instant, tenantTimezone) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Le pone la zona del negocio a una hora que llegó sin zona, SIN cambiar lo
 * que marca el reloj: `2026-10-13T08:22:11.243` → `2026-10-13T08:22:11.243-04:00`.
 *
 * Así cualquier código que después haga `new Date(texto)` obtiene el instante
 * correcto, y el que tome la parte de la fecha (`texto.substring(0, 10)`)
 * sigue viendo el día del negocio.
 */
export function withTenantOffset(naive: string, tenantTimezone: string): string {
  const match = NAIVE_DATETIME.exec(naive.trim());
  if (!match) return naive;
  const [, datePart, hourMinute, seconds, fraction] = match;
  const millis = fraction ? fraction.substring(0, 4).padEnd(4, '0') : '.000';
  const wallClock = `${datePart}T${hourMinute}${seconds ?? ':00'}${millis}`;
  const instant = parseClientDateTime(wallClock, tenantTimezone);
  if (!instant) return naive;
  return `${wallClock}${tenantOffsetLabel(instant, tenantTimezone)}`;
}

/** Fecha del negocio (`YYYY-MM-DD`) que corresponde a un instante. */
export function tenantDateString(tenantTimezone: string, at: Date = new Date()): string {
  try {
    // en-CA formatea como YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tenantTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  } catch {
    return at.toISOString().substring(0, 10);
  }
}

/** Extrae la fecha del negocio de lo que mandó el cliente (fecha, fecha-hora o Date). */
export function toTenantDateString(
  value: string | Date | null | undefined,
  tenantTimezone: string,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && isDateOnlyString(value)) return value.trim();
  const instant = parseClientDateTime(value, tenantTimezone);
  return instant ? tenantDateString(tenantTimezone, instant) : null;
}

/** Primer instante (00:00:00.000) de ese día en el negocio. */
export function tenantDayStart(
  value: string | Date | null | undefined,
  tenantTimezone: string,
): Date | null {
  const day = toTenantDateString(value, tenantTimezone);
  return day ? toUtcAtTenantMidnight(day, tenantTimezone) : null;
}

/** Último instante (23:59:59.999) de ese día en el negocio. */
export function tenantDayEnd(
  value: string | Date | null | undefined,
  tenantTimezone: string,
): Date | null {
  const start = tenantDayStart(value, tenantTimezone);
  if (!start) return null;
  const nextDay = toTenantDateString(new Date(start.getTime() + 36 * 60 * 60 * 1000), tenantTimezone);
  const nextStart = toUtcAtTenantMidnight(nextDay!, tenantTimezone);
  return new Date(nextStart.getTime() - 1);
}

/**
 * Límite INFERIOR de un filtro por rango. Si el cliente mandó solo la fecha,
 * es el inicio de ese día en el negocio; si mandó fecha y hora, ese instante.
 */
export function tenantRangeStart(
  value: string | Date | null | undefined,
  tenantTimezone: string,
): Date | null {
  if (typeof value === 'string' && isDateOnlyString(value)) {
    return tenantDayStart(value, tenantTimezone);
  }
  return parseClientDateTime(value, tenantTimezone);
}

/**
 * Límite SUPERIOR de un filtro por rango. Si el cliente mandó solo la fecha,
 * es el final de ese día en el negocio (para que el día completo entre); si
 * mandó fecha y hora, ese instante.
 */
export function tenantRangeEnd(
  value: string | Date | null | undefined,
  tenantTimezone: string,
): Date | null {
  if (typeof value === 'string' && isDateOnlyString(value)) {
    return tenantDayEnd(value, tenantTimezone);
  }
  return parseClientDateTime(value, tenantTimezone);
}

/** Año, mes (1-12) y día del negocio en ese instante. */
export function tenantDateParts(
  tenantTimezone: string,
  at: Date = new Date(),
): { year: number; month: number; day: number } {
  const [year, month, day] = tenantDateString(tenantTimezone, at).split('-').map(Number);
  return { year, month, day };
}

/** Inicio del mes del negocio que contiene ese instante. */
export function tenantMonthStart(tenantTimezone: string, at: Date = new Date()): Date {
  const { year, month } = tenantDateParts(tenantTimezone, at);
  return toUtcAtTenantMidnight(`${year}-${String(month).padStart(2, '0')}-01`, tenantTimezone);
}

/** Último instante del mes del negocio que contiene ese instante. */
export function tenantMonthEnd(tenantTimezone: string, at: Date = new Date()): Date {
  const { year, month } = tenantDateParts(tenantTimezone, at);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextStart = toUtcAtTenantMidnight(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
    tenantTimezone,
  );
  return new Date(nextStart.getTime() - 1);
}

/**
 * Día del negocio de lo que mandó el cliente, como Date "de calendario"
 * (medianoche local del proceso con el año/mes/día del negocio).
 *
 * Es lo que debe guardarse en columnas tipo `date` (fecha de un gasto,
 * vencimiento de un crédito...): TypeORM toma año/mes/día de ese Date, así
 * que queda guardado el día que el usuario ve en su negocio. Con
 * `new Date(texto)` una venta de las 10 de la noche quedaba en el día
 * siguiente.
 */
export function toTenantCalendarDate(
  value: string | Date | null | undefined,
  tenantTimezone: string,
): Date | null {
  const day = toTenantDateString(value, tenantTimezone);
  if (!day) return null;
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/**
 * Convierte una fecha sin hora (`2026-10-13`) en el mediodía de ese día en
 * el negocio, con su desfase: `2026-10-13T12:00:00.000-04:00`.
 *
 * Una fecha sola, al guardarse en un campo con hora, se tomaba como la
 * medianoche UTC —o sea, la tarde del día ANTERIOR en el negocio— y el
 * registro aparecía con un día menos. Al mediodía del negocio, el día es el
 * correcto tanto en campos con hora como en campos de solo fecha.
 */
export function dateOnlyAtTenantNoon(dateOnly: string, tenantTimezone: string): string {
  const text = dateOnly.trim();
  if (!DATE_ONLY.test(text)) return dateOnly;
  return withTenantOffset(`${text}T12:00:00.000`, tenantTimezone);
}

/** Nombres de campo que son límites de un rango (se resuelven como inicio/fin de día). */
export function isRangeBoundaryKey(key: string): boolean {
  return /^(start|end|from|to|since|until|desde|hasta)/i.test(key) || /(From|To|Start|End|Since|Until)$/.test(key);
}

