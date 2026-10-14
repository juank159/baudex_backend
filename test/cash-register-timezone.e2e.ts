/**
 * Prueba de punta a punta: desglose de caja y zona horaria del negocio.
 *
 * Requiere el backend corriendo contra una base DESECHABLE:
 *   BASE_URL=http://127.0.0.1:3999/api npx ts-node --transpile-only test/cash-register-timezone.e2e.ts
 */
export {};

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3999/api';
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(BASE_URL)) {
  console.error(`ABORTADO: BASE_URL="${BASE_URL}" no es local.`);
  process.exit(2);
}

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` → ${JSON.stringify(detail).substring(0, 700)}` : ''}`);
  }
}

let token = '';
async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data: json?.data ?? json, raw: json };
}

/** Reloj de pared en una zona, sin zona en el texto: `2026-10-13T08:22:11.243` */
function wallClock(timeZone: string, at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  const ms = String(at.getMilliseconds()).padStart(3, '0');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}.${ms}`;
}

async function main() {
  const run = Date.now();
  const TZ = 'America/Caracas';

  const reg = await api('POST', '/auth/register', {
    firstName: 'Caja', lastName: 'Test', email: `caja-${run}@test.local`,
    password: 'Test1234', organizationName: `Caja ${run}`,
  });
  token = reg.data?.token;
  if (!token) throw new Error(`No se pudo registrar: ${JSON.stringify(reg.raw)}`);

  const tz = await api('PATCH', '/organizations/current', { timezone: TZ });
  check('la zona horaria del negocio queda configurada', tz.status < 300, tz.raw);

  const customer = await api('POST', '/customers', {
    firstName: 'Cliente', lastName: 'Caja', email: `cc-${run}@test.local`,
    documentType: 'cc', documentNumber: `${run}`.slice(-10), creditLimit: 1000000,
  });
  const customerId = customer.data?.id;

  const opened = await api('POST', '/cash-register/open', { openingAmount: 150000 });
  check('se abre la caja con base 150.000', opened.status < 300, opened.raw);

  const sale = (total: number, paymentMethod: string, status: string, n: number, extra: Record<string, unknown> = {}) =>
    api('POST', '/invoices', {
      customerId, number: `CJ-${run}-${n}`, paymentMethod, status, taxPercentage: 0,
      skipStockValidation: true,
      items: [{ description: 'Producto', quantity: 1, unitPrice: total, isTemporary: true }],
      ...extra,
    });

  const cash = await sale(10000, 'cash', 'paid', 1);
  const transfer = await sale(7000, 'bank_transfer', 'paid', 2);
  const credit = await sale(5000, 'credit', 'pending', 3, {
    metadata: { createCreditForRemaining: true, remainingBalance: 5000, isPureCreditInvoice: true },
  });
  check('venta en efectivo, por transferencia y fiada se guardan', cash.status < 300 && transfer.status < 300 && credit.status < 300, { cash: cash.raw, transfer: transfer.raw, credit: credit.raw });

  const credits = (await api('GET', `/customer-credits/customer/${customerId}`)).data as any[];
  const creditId = credits[0]?.id;

  console.log('\n1. Abonos en efectivo: app anterior (hora sin zona) y app nueva (instante exacto)');
  const before = Date.now();
  const naive = await api('POST', `/customer-credits/${creditId}/payments`, {
    amount: 2000, paymentMethod: 'cash', paymentDate: wallClock(TZ),
  });
  const exact = await api('POST', `/customer-credits/${creditId}/payments`, {
    amount: 1000, paymentMethod: 'cash', paymentDate: new Date().toISOString(),
  });
  const after = Date.now();
  check('los dos abonos se guardan', naive.status < 300 && exact.status < 300, { naive: naive.raw, exact: exact.raw });
  const payments = (await api('GET', `/customer-credits/${creditId}/payments`)).data as any[];
  const within = (p: any) => {
    const t = new Date(p.paymentDate).getTime();
    return t >= before - 2000 && t <= after + 2000;
  };
  check('la hora sin zona queda guardada en su hora REAL (no 4 horas antes)', payments.length === 2 && payments.every(within), payments.map((p) => p.paymentDate));

  console.log('\n2. Desglose de la caja');
  const current = await api('GET', '/cash-register/current');
  const s = current.data?.summary ?? {};
  check('DINERO ESPERADO EN CAJA = base + solo efectivo (150.000 + 10.000 + 3.000)', Number(current.data?.expectedAmount) === 163000, current.data?.expectedAmount);
  check('efectivo por ventas: 10.000 (1 pago)', Number(s.cashFromSales) === 10000 && s.cashFromSalesCount === 1, s);
  check('efectivo por abonos de crédito: 3.000 (2 abonos) — entran al turno', Number(s.cashFromCreditPayments) === 3000 && s.cashFromCreditPaymentsCount === 2, s);
  check('otros medios: transferencia 7.000, fuera de la caja', Array.isArray(s.otherMethods) && s.otherMethods.length === 1 && s.otherMethods[0].method === 'bank_transfer' && Number(s.otherMethods[0].total) === 7000 && Number(s.otherMethodsTotal) === 7000, s.otherMethods);
  check('total cobrado en el turno: 20.000 (efectivo 13.000 + otros 7.000)', Number(s.totalCollected) === 20000 && Number(s.cashSales) === 13000, { totalCollected: s.totalCollected, cashSales: s.cashSales });
  check('ventas fiadas del turno: 5.000 (no es dinero recibido)', Number(s.creditSalesTotal) === 5000 && s.creditSalesCount === 1, s);
  check('el fiado y la transferencia NO suman al dinero esperado en caja', Number(current.data?.expectedAmount) === 150000 + Number(s.cashSales));

  console.log('\n3. Filtros por día con la zona del negocio');
  const today = wallClock(TZ).substring(0, 10);
  const byDay = await api('GET', `/customer-credits?startDate=${today}&endDate=${today}`);
  const list = Array.isArray(byDay.data) ? byDay.data : byDay.data?.data ?? [];
  check('filtrar "hoy" (solo fecha) trae el crédito de hoy', list.some((c: any) => c.id === creditId), { status: byDay.status, n: list.length });
  const byNaive = await api('GET', `/customer-credits?startDate=${today}T00:00:00.000&endDate=${today}T23:59:59.999`);
  const list2 = Array.isArray(byNaive.data) ? byNaive.data : byNaive.data?.data ?? [];
  check('filtrar con hora sin zona también usa el día del negocio', list2.some((c: any) => c.id === creditId), { status: byNaive.status, n: list2.length });

  console.log('\n4. Cierre de caja');
  const closed = await api('POST', `/cash-register/${opened.data?.id}/close`, { closingActualAmount: 163000 });
  check('al cerrar, lo esperado es 163.000 y la diferencia 0', closed.status < 300 && Number(closed.data?.closingExpectedAmount) === 163000 && Number(closed.data?.closingDifference) === 0, closed.raw);
  check('el cierre guarda el desglose para el historial', Number(closed.data?.closingSummary?.otherMethodsTotal) === 7000 && Number(closed.data?.closingSummary?.totalCollected) === 20000, closed.data?.closingSummary);

  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} VERIFICACIONES FALLARON`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR INESPERADO:', error);
  process.exit(1);
});
