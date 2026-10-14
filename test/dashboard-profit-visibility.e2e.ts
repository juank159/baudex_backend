/**
 * Prueba de punta a punta: la ganancia del dashboard solo la ve el
 * administrador del tenant.
 *
 * Requiere el backend corriendo contra una base DESECHABLE:
 *   BASE_URL=http://127.0.0.1:3999/api npx ts-node --transpile-only test/dashboard-profit-visibility.e2e.ts
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
    console.log(`  FAIL ${name}${detail !== undefined ? ` → ${JSON.stringify(detail).substring(0, 600)}` : ''}`);
  }
}

async function api(method: string, path: string, token?: string, body?: unknown) {
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

const PROFIT_FIELDS = ['totalCOGS', 'grossProfit', 'netProfit', 'grossMarginPercentage', 'netMarginPercentage', 'totalProfit'];

async function main() {
  const run = Date.now();
  const password = 'Test1234';

  // Administrador (dueño del tenant)
  const reg = await api('POST', '/auth/register', undefined, {
    firstName: 'Admin', lastName: 'Tenant', email: `admin-${run}@test.local`,
    password, organizationName: `Profit ${run}`,
  });
  const adminToken = reg.data?.token;
  if (!adminToken) throw new Error(`No se pudo registrar: ${JSON.stringify(reg.raw)}`);

  // Empleado y encargado creados por el administrador
  const tokens: Record<string, string> = { admin: adminToken };
  for (const role of ['user', 'manager']) {
    const email = `${role}-${run}@test.local`;
    const created = await api('POST', '/users', adminToken, {
      firstName: role, lastName: 'Empleado', email, password, role,
    });
    if (created.status >= 300) throw new Error(`No se pudo crear ${role}: ${JSON.stringify(created.raw)}`);
    const login = await api('POST', '/auth/login', undefined, { email, password });
    if (!login.data?.token) throw new Error(`No se pudo iniciar sesión como ${role}: ${JSON.stringify(login.raw)}`);
    tokens[role] = login.data.token;
  }

  // Datos: una venta de contado de 10.000 con un producto cuyo costo es 6.000,
  // para que exista ganancia real que ocultar.
  const customer = await api('POST', '/customers', adminToken, {
    firstName: 'Cliente', lastName: 'Contado', email: `c-${run}@test.local`,
    documentType: 'cc', documentNumber: `${run}`.slice(-10),
  });
  const invoice = await api('POST', '/invoices', adminToken, {
    customerId: customer.data?.id,
    number: `PV-${run}`,
    paymentMethod: 'bank_transfer',
    status: 'paid',
    taxPercentage: 0,
    skipStockValidation: true,
    items: [{ description: 'Producto', quantity: 1, unitPrice: 10000, isTemporary: true }],
  });
  if (invoice.status >= 300) throw new Error(`No se pudo crear la venta: ${JSON.stringify(invoice.raw)}`);

  // Rango amplio: la fecha de la venta depende de la zona horaria del tenant.
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toISOString().substring(0, 10);
  const range = `startDate=${day(-3)}&endDate=${day(1)}`;

  console.log('\n1. Administrador del tenant');
  {
    const prof = await api('GET', `/dashboard/profitability?${range}`, tokens.admin);
    const sum = await api('GET', `/dashboard/summary?${range}`, tokens.admin);
    check('rentabilidad responde 200 con datos reales', prof.status === 200 && prof.data?.profitRestricted !== true && Number(prof.data?.totalRevenue) > 0, prof.raw);
    check('resumen responde 200 sin restricción', sum.status === 200 && sum.data?.profitRestricted !== true, sum.raw);
    check('el resumen del administrador trae ganancia', Number(sum.data?.grossProfit) !== 0 || Number(sum.data?.totalProfit) !== 0, { grossProfit: sum.data?.grossProfit, totalProfit: sum.data?.totalProfit });
  }

  for (const role of ['user', 'manager']) {
    console.log(`\n2. Rol "${role}" (${role === 'user' ? 'empleado' : 'encargado'})`);
    const prof = await api('GET', `/dashboard/profitability?${range}`, tokens[role]);
    const sum = await api('GET', `/dashboard/summary?${range}`, tokens[role]);

    check('rentabilidad responde 200 (no 403, que la app toma por suscripción vencida)', prof.status === 200, prof.status);
    check('rentabilidad marcada como restringida', prof.data?.profitRestricted === true, prof.raw);
    const leakedProf = Object.entries(prof.data || {}).filter(([k, v]) => typeof v === 'number' && v !== 0);
    check('ningún número de rentabilidad distinto de 0', leakedProf.length === 0, leakedProf);
    check('sin listas de productos/categorías rentables', Object.values(prof.data || {}).filter(Array.isArray).every((a: any) => a.length === 0));

    check('resumen responde 200 y marcado como restringido', sum.status === 200 && sum.data?.profitRestricted === true, sum.raw);
    const leaked = PROFIT_FIELDS.filter((f) => Number(sum.data?.[f]) !== 0);
    check('ganancia, costo y márgenes en 0 en el resumen', leaked.length === 0 && String(sum.data?.profitMargin) === '0', { leaked, profitMargin: sum.data?.profitMargin });
    check('la ganancia mensual y la serie de ganancia van en 0',
      Number(sum.data?.monthlyStats?.currentMonth?.profit ?? 0) === 0 &&
      Number(sum.data?.monthlyStats?.previousMonth?.profit ?? 0) === 0 &&
      (sum.data?.chartData?.profit ?? []).every((n: number) => n === 0),
      { monthly: sum.data?.monthlyStats, chart: sum.data?.chartData?.profit });
    check('sí conserva lo que necesita para trabajar (ventas y facturas)', Number(sum.data?.totalInvoices) >= 1 && Number(sum.data?.totalBilled ?? sum.data?.totalRevenue) > 0, { totalInvoices: sum.data?.totalInvoices, totalBilled: sum.data?.totalBilled });
  }

  console.log('\n3. Ruta pública de estado');
  {
    const health = await api('GET', '/health');
    const text = JSON.stringify(health.raw || {});
    check('no publica ingresos, costos ni ganancia', health.status === 200 && !/profit|cogs|revenue|ganancia|fifo/i.test(text), text.substring(0, 300));
  }

  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} VERIFICACIONES FALLARON`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR INESPERADO:', error);
  process.exit(1);
});
