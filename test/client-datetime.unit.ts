/**
 * Prueba de `parseClientDateTime`: la hora que manda la app se interpreta en
 * la zona horaria del negocio cuando no trae zona explícita.
 *
 *   npx ts-node --transpile-only test/client-datetime.unit.ts
 */
import {
  dateOnlyAtTenantNoon,
  parseClientDateTime,
  tenantDateString,
  tenantDayEnd,
  tenantDayStart,
  tenantMonthEnd,
  tenantMonthStart,
  tenantRangeEnd,
  tenantRangeStart,
  toTenantCalendarDate,
  withTenantOffset,
} from '../src/common/utils/timezone-range.util';
import {
  runWithTenantTimezone,
  tenantNowParts,
  tenantToday,
  tenantTodaySql,
  tenantWallClockNow,
} from '../src/common/utils/tenant-clock';
import { TenantDateTimeInterceptor } from '../src/common/interceptors/tenant-datetime.interceptor';
import { firstValueFrom, of } from 'rxjs';

let failures = 0;
function check(name: string, actual: Date | null, expectedIso: string | null) {
  const got = actual ? actual.toISOString() : null;
  if (got === expectedIso) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} → esperado ${expectedIso}, obtenido ${got}`);
  }
}

console.log('\nHora sin zona = reloj del negocio');
// Caso real de Mercaexpress: abono a las 08:22 de la mañana en Caracas (UTC-4)
check('08:22 en Caracas → 12:22 UTC', parseClientDateTime('2026-10-13T08:22:11.243', 'America/Caracas'), '2026-10-13T12:22:11.243Z');
check('08:22 en Bogotá → 13:22 UTC', parseClientDateTime('2026-10-13T08:22:11.243', 'America/Bogota'), '2026-10-13T13:22:11.243Z');
check('con espacio en vez de T', parseClientDateTime('2026-10-13 08:22:11', 'America/Caracas'), '2026-10-13T12:22:11.000Z');
check('23:30 en Caracas cae al día siguiente en UTC', parseClientDateTime('2026-10-13T23:30:00.000', 'America/Caracas'), '2026-10-14T03:30:00.000Z');
check('microsegundos de Dart', parseClientDateTime('2026-10-13T08:22:11.243123', 'America/Caracas'), '2026-10-13T12:22:11.243Z');

console.log('\nHora con zona explícita = se respeta');
check('con Z', parseClientDateTime('2026-10-13T12:22:11.243Z', 'America/Caracas'), '2026-10-13T12:22:11.243Z');
check('con desfase -04:00', parseClientDateTime('2026-10-13T08:22:11.243-04:00', 'America/Bogota'), '2026-10-13T12:22:11.243Z');
check('con desfase +0000', parseClientDateTime('2026-10-13T12:22:11+0000', 'America/Caracas'), '2026-10-13T12:22:11.000Z');

console.log('\nSolo fecha = mediodía de ese día en el negocio (nunca el día anterior)');
check('2026-10-13 en Caracas', parseClientDateTime('2026-10-13', 'America/Caracas'), '2026-10-13T16:00:00.000Z');

console.log('\nZona con horario de verano');
check('verano en Nueva York (UTC-4)', parseClientDateTime('2026-07-01T09:00:00', 'America/New_York'), '2026-07-01T13:00:00.000Z');
check('invierno en Nueva York (UTC-5)', parseClientDateTime('2026-01-15T09:00:00', 'America/New_York'), '2026-01-15T14:00:00.000Z');

console.log('\nValores vacíos o inválidos');
check('undefined', parseClientDateTime(undefined, 'America/Caracas'), null);
check('texto inválido', parseClientDateTime('no-es-fecha', 'America/Caracas'), null);
const d = new Date('2026-10-13T12:00:00Z');
check('un Date se devuelve igual', parseClientDateTime(d, 'America/Caracas'), '2026-10-13T12:00:00.000Z');

function same(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} → esperado ${e}, obtenido ${a}`);
  }
}

console.log('\nAgregar la zona sin cambiar el reloj');
same('hora sin zona → mismo reloj + desfase', withTenantOffset('2026-10-13T23:59:59.999', 'America/Caracas'), '2026-10-13T23:59:59.999-04:00');
same('sin segundos', withTenantOffset('2026-10-13 08:22', 'America/Bogota'), '2026-10-13T08:22:00.000-05:00');
same('la parte de la fecha sigue siendo el día del negocio', withTenantOffset('2026-10-13T23:59:59.999', 'America/Caracas').substring(0, 10), '2026-10-13');
same('fecha sola → mediodía de ese día', dateOnlyAtTenantNoon('2026-10-13', 'America/Caracas'), '2026-10-13T12:00:00.000-04:00');

console.log('\nEl día del negocio no es el día UTC');
// 9:30 pm del 13 en Caracas ya es 14 en UTC
const lateEvening = new Date('2026-10-14T01:30:00Z');
same('a las 9:30 pm en Caracas sigue siendo 13', tenantDateString('America/Caracas', lateEvening), '2026-10-13');
check('inicio del 13 en Caracas', tenantDayStart('2026-10-13', 'America/Caracas'), '2026-10-13T04:00:00.000Z');
check('fin del 13 en Caracas', tenantDayEnd('2026-10-13', 'America/Caracas'), '2026-10-14T03:59:59.999Z');
check('inicio del día de un instante', tenantDayStart(lateEvening, 'America/Caracas'), '2026-10-13T04:00:00.000Z');
check('filtro "desde" con fecha sola = inicio del día', tenantRangeStart('2026-10-13', 'America/Bogota'), '2026-10-13T05:00:00.000Z');
check('filtro "hasta" con fecha sola = fin del día (el día entra completo)', tenantRangeEnd('2026-10-13', 'America/Bogota'), '2026-10-14T04:59:59.999Z');
check('filtro "hasta" con hora = ese instante', tenantRangeEnd('2026-10-13T18:00:00.000-05:00', 'America/Bogota'), '2026-10-13T23:00:00.000Z');
check('inicio de mes del negocio', tenantMonthStart('America/Caracas', new Date('2026-11-01T02:00:00Z')), '2026-10-01T04:00:00.000Z');
check('fin de mes del negocio', tenantMonthEnd('America/Caracas', new Date('2026-11-01T02:00:00Z')), '2026-11-01T03:59:59.999Z');

console.log('\nFecha para columnas de solo fecha (gasto, vencimiento)');
const calendar = toTenantCalendarDate('2026-10-13T22:00:00.000-04:00', 'America/Caracas')!;
same('una venta de las 10 pm queda en el día 13, no en el 14', [calendar.getFullYear(), calendar.getMonth() + 1, calendar.getDate()], [2026, 10, 13]);
const fromDateOnly = toTenantCalendarDate('2026-10-13', 'America/Caracas')!;
same('una fecha sola conserva su día', [fromDateOnly.getFullYear(), fromDateOnly.getMonth() + 1, fromDateOnly.getDate()], [2026, 10, 13]);

console.log('\nReloj del negocio por petición');
runWithTenantTimezone('America/Caracas', () => {
  same('hoy del negocio', tenantToday(lateEvening), '2026-10-13');
  same('partes de hoy', tenantNowParts(lateEvening), { year: 2026, month: 10, day: 13 });
  same('hoy para SQL', tenantTodaySql(lateEvening), `'2026-10-13'::date`);
  const wall = tenantWallClockNow(lateEvening);
  same('reloj de pared: 13 de octubre, 9:30 pm', [wall.getFullYear(), wall.getMonth() + 1, wall.getDate(), wall.getHours(), wall.getMinutes()], [2026, 10, 13, 21, 30]);
});
runWithTenantTimezone('Asia/Tokyo', () => {
  same('otro negocio, otro día (Tokio ya va en el 14)', tenantToday(lateEvening), '2026-10-14');
});

async function interceptorTests() {
  console.log('\nInterceptor global: toda hora sin zona toma la zona del negocio');
  const interceptor = new TenantDateTimeInterceptor({
    remember: (_id: string, tz: string) => tz,
    forOrganization: async () => 'America/Caracas',
  } as any);
  const run = async (body: any, query: any) => {
    const req: any = { body, query, tenant: { id: 'org', organization: { timezone: 'America/Caracas' } } };
    const context: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
    await firstValueFrom(interceptor.intercept(context, { handle: () => of(null) } as any));
    return req;
  };

  const req = await run(
    {
      paymentDate: '2026-10-13T08:22:11.243',
      date: '2026-10-13',
      startDate: '2026-10-01',
      already: '2026-10-13T12:22:11.243Z',
      notes: 'entregado el 2026-10-13 a las 08:22',
      amount: 140000,
      items: [{ expirationDate: '2027-01-31', receivedAt: '2026-10-13T09:00:00' }],
      metadata: { nested: { at: '2026-10-13 10:15:00' } },
    },
    { startDate: '2026-10-13T00:00:00.000', endDate: '2026-10-13T23:59:59.999', day: '2026-10-13', page: '1' },
  );
  same('cuerpo: fecha-hora sin zona', req.body.paymentDate, '2026-10-13T08:22:11.243-04:00');
  same('cuerpo: fecha sola → mediodía del negocio', req.body.date, '2026-10-13T12:00:00.000-04:00');
  same('cuerpo: límite de rango con fecha sola no se toca', req.body.startDate, '2026-10-01');
  same('lo que ya trae zona no se toca', req.body.already, '2026-10-13T12:22:11.243Z');
  same('un texto normal no se toca', req.body.notes, 'entregado el 2026-10-13 a las 08:22');
  same('los números no se tocan', req.body.amount, 140000);
  same('listas anidadas', req.body.items[0], { expirationDate: '2027-01-31T12:00:00.000-04:00', receivedAt: '2026-10-13T09:00:00.000-04:00' });
  same('objetos anidados', req.body.metadata.nested.at, '2026-10-13T10:15:00.000-04:00');
  same('consulta: inicio de rango con hora', req.query.startDate, '2026-10-13T00:00:00.000-04:00');
  same('consulta: fin de rango con hora (sigue siendo el día 13)', req.query.endDate, '2026-10-13T23:59:59.999-04:00');
  same('consulta: fecha sola no se toca', req.query.day, '2026-10-13');
  same('consulta: otros parámetros no se tocan', req.query.page, '1');
}

interceptorTests().then(() => {
  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} VERIFICACIONES FALLARON`);
  process.exit(failures === 0 ? 0 : 1);
});
