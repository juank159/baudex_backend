/**
 * Prueba de punta a punta por HTTP real: reenvíos, venta a crédito y límite.
 *
 * Requiere el backend corriendo contra una base DESECHABLE:
 *   DB_NAME=baudex_test ... PORT=3999 node dist/main
 *   BASE_URL=http://127.0.0.1:3999/api npx ts-node --transpile-only test/sync-safety.e2e.ts
 *
 * Por seguridad solo corre contra localhost / 127.0.0.1.
 */
export {};

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3999/api';
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(BASE_URL)) {
  console.error(`ABORTADO: BASE_URL="${BASE_URL}" no es local. Esta prueba crea datos.`);
  process.exit(2);
}

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` → ${JSON.stringify(detail).substring(0, 500)}` : ''}`);
  }
}

let token = '';
async function api(method: string, path: string, body?: unknown, key?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data: json?.data ?? json, raw: json };
}

async function main() {
  const run = Date.now();

  const reg = await api('POST', '/auth/register', {
    firstName: 'E2E', lastName: 'Sync', email: `e2e-${run}@test.local`,
    password: 'Test1234', organizationName: `E2E ${run}`,
  });
  token = reg.data?.token;
  if (!token) throw new Error(`No se pudo registrar: ${JSON.stringify(reg.raw)}`);

  const customerBody = {
    firstName: 'Cliente', lastName: 'Fiado', email: `cliente-${run}@test.local`,
    documentType: 'cc', documentNumber: `${run}`.slice(-10), creditLimit: 100000,
  };

  console.log('\n1. Crear un cliente y reenviar la misma operación (cualquier módulo)');
  const c1 = await api('POST', '/customers', customerBody, `cust-${run}`);
  const c2 = await api('POST', '/customers', customerBody, `cust-${run}`);
  const c3 = await api('POST', '/customers', customerBody, `cust-${run}`);
  check('la primera crea el cliente', c1.status < 300 && !!c1.data?.id, c1.raw);
  check('los reenvíos responden OK con el MISMO cliente (no "ya existe")', c2.status === c1.status && c2.data?.id === c1.data?.id && c3.data?.id === c1.data?.id, { s2: c2.status, d2: c2.raw });
  const customerId = c1.data.id;

  const invoiceBody = (total: number, number: string) => ({
    customerId,
    number,
    paymentMethod: 'credit',
    status: 'pending',
    taxPercentage: 0,
    skipStockValidation: true,
    items: [{ description: 'Mercado fiado', quantity: 1, unitPrice: total, isTemporary: true }],
    metadata: { createCreditForRemaining: true, remainingBalance: total, isPureCreditInvoice: true },
  });
  const credits = async () => (await api('GET', `/customer-credits/customer/${customerId}`)).data as any[];
  const debt = async () => (await credits()).filter((c) => c.status !== 'paid' && c.status !== 'cancelled').reduce((s, c) => s + Number(c.balanceDue), 0);

  console.log('\n2. Venta 100% a crédito: el crédito nace con la factura');
  const inv1 = await api('POST', '/invoices', invoiceBody(60000, `E2E-${run}-1`), `inv-${run}-1`);
  check('la venta se guarda', inv1.status < 300 && !!inv1.data?.id, inv1.raw);
  let list = await credits();
  check('el crédito ya existe SIN que la app lo pida aparte', list.length === 1 && Number(list[0].balanceDue) === 60000 && list[0].invoiceId === inv1.data?.id, list);

  console.log('\n3. La app reenvía la venta y además pide crear el crédito (como las versiones anteriores)');
  const inv1Again = await api('POST', '/invoices', invoiceBody(60000, `E2E-${run}-1`), `inv-${run}-1`);
  check('el reenvío devuelve la MISMA venta', inv1Again.status < 300 && inv1Again.data?.id === inv1.data?.id, inv1Again.raw);
  const legacyCredit = await api('POST', '/customer-credits', {
    customerId, originalAmount: 60000, invoiceId: inv1.data.id,
    description: `Crédito por venta a crédito - Factura E2E-${run}-1`,
  });
  list = await credits();
  check('pedir el crédito otra vez devuelve el existente', legacyCredit.status < 300 && legacyCredit.data?.id === list[0]?.id, legacyCredit.raw);
  check('sigue habiendo 1 solo crédito por 60.000', list.length === 1 && (await debt()) === 60000, list);

  console.log('\n4. Límite de crédito = deuda pendiente (límite 100.000, debe 60.000)');
  const over = await api('POST', '/invoices', invoiceBody(50000, `E2E-${run}-2`), `inv-${run}-2`);
  check('fiar 50.000 más se RECHAZA con mensaje claro', over.status === 400 && JSON.stringify(over.raw).includes('LÍMITE DE CRÉDITO EXCEDIDO'), over.raw);
  check('no se guardó nada (deuda sigue en 60.000, 1 crédito)', (await credits()).length === 1 && (await debt()) === 60000);
  const exact = await api('POST', '/invoices', invoiceBody(40000, `E2E-${run}-3`), `inv-${run}-3`);
  check('fiar 40.000 (queda justo en el límite) SÍ pasa', exact.status < 300 && (await debt()) === 100000, exact.raw);

  console.log('\n5. Abono reenviado y cupo liberado');
  list = await credits();
  const first = list.find((c) => Number(c.balanceDue) === 60000);
  const payBody = { amount: 60000, paymentMethod: 'bank_transfer' };
  const p1 = await api('POST', `/customer-credits/${first.id}/payments`, payBody, `pay-${run}`);
  const p2 = await api('POST', `/customer-credits/${first.id}/payments`, payBody, `pay-${run}`);
  check('abono y reenvío responden OK con el mismo abono', p1.status < 300 && p2.status < 300 && p1.data?.payment?.id === p2.data?.payment?.id, { p1: p1.raw, p2: p2.raw });
  const payments = (await api('GET', `/customer-credits/${first.id}/payments`)).data as any[];
  check('1 solo abono registrado', payments.length === 1, payments);
  check('la deuda pendiente baja a 40.000 (lo pagado ya no cuenta)', (await debt()) === 40000);
  const afterPay = await api('POST', '/invoices', invoiceBody(60000, `E2E-${run}-4`), `inv-${run}-4`);
  check('ahora puede fiar 60.000 otra vez, aunque su historial ya suma 160.000', afterPay.status < 300 && (await debt()) === 100000, afterPay.raw);

  const customer = (await api('GET', `/customers/${customerId}`)).data;
  check('el saldo guardado del cliente = deuda real', Number(customer?.creditBalance) === 100000, { creditBalance: customer?.creditBalance, currentBalance: customer?.currentBalance });

  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} VERIFICACIONES FALLARON`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR INESPERADO:', error);
  process.exit(1);
});
