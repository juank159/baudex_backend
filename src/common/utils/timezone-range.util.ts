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
