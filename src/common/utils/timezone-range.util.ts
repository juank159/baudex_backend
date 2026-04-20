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
  const local = new Date(`${dateStr}T00:00:00`);
  const tzOffsetMs = getTimezoneOffsetMs(local, tenantTimezone);
  return new Date(local.getTime() - tzOffsetMs);
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
