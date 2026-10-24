/**
 * Prueba de integración: abonos a créditos bajo concurrencia y reintentos.
 *
 * Verifica contra un PostgreSQL REAL (no mocks) que:
 *  - un abono reenviado (misma clave de idempotencia) nunca se duplica,
 *  - dos abonos simultáneos al mismo crédito no se pisan ni se pierden,
 *  - el reenvío exacto de versiones anteriores de la app no se duplica,
 *  - el sobrepago queda como saldo a favor una sola vez,
 *  - la factura y los acumulados del cliente quedan iguales a los créditos.
 *
 * Uso (base de datos DESECHABLE, con las migraciones ya aplicadas):
 *   DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=x \
 *   DB_NAME=baudex_test DB_SSL=false \
 *   npx ts-node --transpile-only -r tsconfig-paths/register test/credit-payments.concurrency.ts
 *
 * Por seguridad se niega a correr si DB_NAME no termina en "_test".
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { CustomerCreditsService } from '../src/customer-credits/customer-credits.service';
import { ClientBalanceService } from '../src/customer-credits/client-balance.service';
import { CustomersService } from '../src/customers/customers.service';
import { CustomerCredit } from '../src/customer-credits/entities/customer-credit.entity';
import { CreditPayment } from '../src/customer-credits/entities/credit-payment.entity';
import { CreditTransaction } from '../src/customer-credits/entities/credit-transaction.entity';
import { ClientBalance } from '../src/customer-credits/entities/client-balance.entity';
import { ClientBalanceTransaction } from '../src/customer-credits/entities/client-balance-transaction.entity';
import { Invoice, PaymentMethod } from '../src/invoices/entities/invoice.entity';
import { Organization } from '../src/organizations/entities/organization.entity';
import { Customer } from '../src/customers/entities/customer.entity';

const dbName = process.env.DB_NAME || '';
if (!dbName.endsWith('_test')) {
  console.error(
    `ABORTADO: DB_NAME="${dbName}" no termina en "_test". Esta prueba escribe datos; solo corre contra una base desechable.`,
  );
  process.exit(2);
}

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  }
}

async function settle<T>(promises: Promise<T>[]) {
  const results = await Promise.allSettled(promises);
  return {
    ok: results.filter((r) => r.status === 'fulfilled').map((r: any) => r.value as T),
    errors: results.filter((r) => r.status === 'rejected').map((r: any) => r.reason),
  };
}

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: dbName,
    entities: [join(__dirname, '../src/**/*.entity{.ts,.js}')],
    synchronize: false,
    logging: false,
    extra: { max: 30, options: '-c timezone=UTC' },
  });
  await dataSource.initialize();

  const q = (sql: string, params: unknown[] = []) => dataSource.query(sql, params);
  const run = Date.now();

  const [{ id: orgId }] = await q(
    `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
    [`Test ${run}`, `test-${run}`],
  );
  const [{ id: userId }] = await q(
    `INSERT INTO users ("firstName", "lastName", email, password, organization_id)
     VALUES ('Test', 'User', $1, 'x', $2) RETURNING id`,
    [`user-${run}@test.local`, orgId],
  );

  let seq = 0;
  const newCustomer = async () => {
    seq++;
    const [{ id }] = await q(
      `INSERT INTO customers ("firstName", "lastName", email, "documentNumber", organization_id, "creditLimit")
       VALUES ('Cliente', $1, $2, $3, $4, 3000000) RETURNING id`,
      [`${seq}`, `c${seq}-${run}@test.local`, `DOC-${run}-${seq}`, orgId],
    );
    return id as string;
  };
  const newInvoice = async (customerId: string, total: number) => {
    seq++;
    const [{ id }] = await q(
      `INSERT INTO invoices (number, date, "dueDate", status, "paymentMethod", total, "paidAmount", "balanceDue", organization_id, "customerId", "createdById")
       VALUES ($1, now(), now(), 'pending', 'credit', $2, 0, $2, $3, $4, $5) RETURNING id`,
      [`INV-T-${run}-${seq}`, total, orgId, customerId, userId],
    );
    return id as string;
  };
  const newCredit = async (customerId: string, amount: number, invoiceId: string | null = null) => {
    const [{ id }] = await q(
      `INSERT INTO customer_credits (original_amount, paid_amount, balance_due, status, customer_id, invoice_id, organization_id, created_by_id)
       VALUES ($1, 0, $1, 'pending', $2, $3, $4, $5) RETURNING id`,
      [amount, customerId, invoiceId, orgId, userId],
    );
    return id as string;
  };
  const creditRow = async (id: string) =>
    (await q(`SELECT paid_amount::float8 paid, balance_due::float8 due, status FROM customer_credits WHERE id = $1`, [id]))[0];
  const paymentCount = async (id: string) =>
    +(await q(`SELECT count(*)::int n FROM credit_payments WHERE credit_id = $1 AND deleted_at IS NULL`, [id]))[0].n;
  const customerRow = async (id: string) =>
    (
      await q(
        `SELECT c.credit_balance::float8 credit_balance, c."currentBalance"::float8 current_balance,
                COALESCE((SELECT SUM(balance_due) FROM customer_credits cc WHERE cc.customer_id = c.id AND cc.deleted_at IS NULL AND cc.status IN ('pending','partially_paid','overdue')), 0)::float8 real_debt
           FROM customers c WHERE c.id = $1`,
        [id],
      )
    )[0];

  // Servicios reales, con el tenant fijo y la caja siempre abierta.
  const tenantAware: any = { getTenantId: () => orgId };
  const cashRegister: any = { getOpenCashRegister: async () => ({ id: 'open' }) };
  const seedService: any = {};
  const customersService = new CustomersService(dataSource.getRepository(Customer), tenantAware, seedService);
  const clientBalanceService = new ClientBalanceService(
    dataSource.getRepository(ClientBalance),
    dataSource.getRepository(ClientBalanceTransaction),
    tenantAware,
    customersService,
    dataSource,
  );
  const credits = new CustomerCreditsService(
    dataSource.getRepository(CustomerCredit),
    dataSource.getRepository(CreditPayment),
    dataSource.getRepository(CreditTransaction),
    dataSource.getRepository(Invoice),
    dataSource.getRepository(Organization),
    tenantAware,
    customersService,
    clientBalanceService,
    cashRegister,
    dataSource,
  );
  const pay = (creditId: string, amount: number, extra: Record<string, unknown> = {}, headerKey?: string) =>
    credits.addPayment(
      creditId,
      { amount, paymentMethod: PaymentMethod.CASH, ...extra } as any,
      userId,
      headerKey,
    );

  // Silenciar los logs del servicio durante la prueba
  const realLog = console.log;
  const realWarn = console.warn;
  const quiet = () => { console.log = () => undefined; console.warn = () => undefined; };
  const loud = () => { console.log = realLog; console.warn = realWarn; };

  // ---------------------------------------------------------------
  loud(); console.log('\n1. Mismo abono enviado 12 veces a la vez con la misma clave');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 10000);
    quiet();
    const { ok, errors } = await settle(
      Array.from({ length: 12 }, () => pay(credit, 4000, {}, 'key-same-abono')),
    );
    loud();
    const row = await creditRow(credit);
    check('las 12 respuestas son exitosas', ok.length === 12 && errors.length === 0, errors.map((e) => e?.message));
    check('todas devuelven el MISMO abono', new Set(ok.map((r) => r.payment.id)).size === 1);
    check('solo 1 abono guardado', (await paymentCount(credit)) === 1, await paymentCount(credit));
    check('saldo 6000, pagado 4000', row.paid === 4000 && row.due === 6000, row);
    check('la respuesta trae el saldo ya actualizado', ok.every((r) => Number(r.credit.balanceDue) === 6000), ok.map((r) => r.credit.balanceDue));
    const c = await customerRow(customer);
    check('acumulados del cliente = deuda real', c.credit_balance === c.real_debt && c.current_balance === c.real_debt, c);
  }

  // ---------------------------------------------------------------
  console.log('\n2. Reintento posterior con la misma clave (en el body)');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 5000);
    quiet();
    const first = await pay(credit, 5000, { idempotencyKey: 'retry-body-key' });
    const second = await pay(credit, 5000, { idempotencyKey: 'retry-body-key' });
    loud();
    check('el reintento responde OK (no "ya pagado")', second.payment.id === first.payment.id && second.idempotent === true);
    check('solo 1 abono guardado', (await paymentCount(credit)) === 1);
  }

  // ---------------------------------------------------------------
  console.log('\n3. Doble envío simultáneo SIN clave del pago total (app anterior)');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 17500);
    quiet();
    const { ok, errors } = await settle([pay(credit, 17500), pay(credit, 17500)]);
    loud();
    const row = await creditRow(credit);
    check('1 aceptado y 1 rechazado', ok.length === 1 && errors.length === 1, { ok: ok.length, errors: errors.map((e) => e?.message) });
    check('solo 1 abono guardado', (await paymentCount(credit)) === 1, await paymentCount(credit));
    check('crédito pagado sin saldo a favor fantasma', row.status === 'paid' && row.due === 0, row);
    const balance = await q(`SELECT balance::float8 b FROM client_balances WHERE customer_id = $1`, [customer]);
    check('no se generó saldo a favor', balance.length === 0 || balance[0].b === 0, balance);
  }

  // ---------------------------------------------------------------
  console.log('\n4. Reenvío exacto de app anterior (misma marca de tiempo del dispositivo, sin clave estable)');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 35000);
    const deviceTime = '2026-09-17T09:12:00.032';
    quiet();
    const { ok, errors } = await settle([
      pay(credit, 4600, { paymentDate: deviceTime }, 'idem_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      pay(credit, 4600, { paymentDate: deviceTime }, 'idem_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    ]);
    const later = await pay(credit, 4600, { paymentDate: deviceTime }, 'idem_cccccccccccccccccccccccccccccccc');
    loud();
    const row = await creditRow(credit);
    check('todas las respuestas son exitosas', ok.length === 2 && errors.length === 0, errors.map((e) => e?.message));
    check('solo 1 abono guardado', (await paymentCount(credit)) === 1, await paymentCount(credit));
    check('reintento tardío tampoco duplica', later.idempotent === true);
    check('saldo 30400', row.due === 30400 && row.paid === 4600, row);
  }

  // ---------------------------------------------------------------
  console.log('\n5. Dos abonos reales del mismo monto el mismo día (fecha de calendario, sin clave)');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 10000);
    quiet();
    await pay(credit, 2000, { paymentDate: '2026-10-13T00:00:00.000' });
    await pay(credit, 2000, { paymentDate: '2026-10-13T00:00:00.000' });
    loud();
    const row = await creditRow(credit);
    check('se guardan los 2 (no se confunden con duplicado)', (await paymentCount(credit)) === 2);
    check('saldo 6000', row.due === 6000 && row.paid === 4000, row);
  }

  // ---------------------------------------------------------------
  console.log('\n6. 8 abonos distintos simultáneos al mismo crédito (no se pisan)');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 10000);
    quiet();
    const { ok, errors } = await settle(
      Array.from({ length: 8 }, (_, i) => pay(credit, 1000, {}, `distinct-${i}`)),
    );
    loud();
    const row = await creditRow(credit);
    check('los 8 se aceptan', ok.length === 8 && errors.length === 0, errors.map((e) => e?.message));
    check('8 abonos guardados', (await paymentCount(credit)) === 8);
    check('pagado 8000, saldo 2000 (ninguno se perdió)', row.paid === 8000 && row.due === 2000, row);
    const tx = await q(`SELECT balance_after::float8 b FROM credit_transactions WHERE credit_id = $1 AND type = 'payment' ORDER BY balance_after DESC`, [credit]);
    check('los saldos del historial bajan de 1000 en 1000', JSON.stringify(tx.map((t: any) => t.b)) === JSON.stringify([9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000]), tx.map((t: any) => t.b));
  }

  // ---------------------------------------------------------------
  console.log('\n7. Pago masivo: 6 créditos del mismo cliente pagados a la vez');
  {
    const customer = await newCustomer();
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push(await newCredit(customer, 5000 + i * 1000));
    const untouched = await newCredit(customer, 7777);
    await customersService.recalculateCreditBalances(customer, orgId);
    quiet();
    const { errors } = await settle(ids.map((id, i) => pay(id, 5000 + i * 1000, {}, `bulk-${i}`)));
    loud();
    const c = await customerRow(customer);
    check('sin errores', errors.length === 0, errors.map((e) => e?.message));
    check('deuda real = solo el crédito no pagado (7777)', c.real_debt === 7777, c);
    check('credit_balance = deuda real', c.credit_balance === 7777, c);
    check('currentBalance = deuda real', c.current_balance === 7777, c);
    check('el crédito no tocado sigue intacto', (await creditRow(untouched)).due === 7777);
  }

  // ---------------------------------------------------------------
  console.log('\n8. Sobrepago: el excedente queda como saldo a favor una sola vez');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 10000);
    quiet();
    const { ok, errors } = await settle(
      Array.from({ length: 5 }, () => pay(credit, 15000.01, {}, 'overpay-key')),
    );
    loud();
    const row = await creditRow(credit);
    const balance = await q(`SELECT balance::float8 b FROM client_balances WHERE customer_id = $1`, [customer]);
    const deposits = await q(
      `SELECT count(*)::int n FROM client_balance_transactions t JOIN client_balances b ON b.id = t.client_balance_id WHERE b.customer_id = $1`,
      [customer],
    );
    check('respuestas exitosas', ok.length === 5 && errors.length === 0, errors.map((e) => e?.message));
    check('crédito pagado', row.status === 'paid' && row.due === 0 && row.paid === 10000, row);
    check('saldo a favor = 5000.01 exacto', balance.length === 1 && balance[0].b === 5000.01, balance);
    check('1 solo depósito de saldo a favor', deposits[0].n === 1, deposits);
    check('1 solo abono', (await paymentCount(credit)) === 1);
  }

  // ---------------------------------------------------------------
  console.log('\n9. Crédito de factura: la factura queda igual al crédito');
  {
    const customer = await newCustomer();
    const invoice = await newInvoice(customer, 22999.99);
    const credit = await newCredit(customer, 22999.99, invoice);
    quiet();
    await settle([pay(credit, 10000, {}, 'inv-a'), pay(credit, 10000, {}, 'inv-a'), pay(credit, 2999.99, {}, 'inv-b')]);
    loud();
    const row = await creditRow(credit);
    const inv = (await q(`SELECT "paidAmount"::float8 paid, "balanceDue"::float8 due, status FROM invoices WHERE id = $1`, [invoice]))[0];
    const invPayments = await q(`SELECT count(*)::int n, COALESCE(SUM(amount),0)::float8 total FROM payments WHERE "invoiceId" = $1`, [invoice]);
    check('crédito: pagado 12999.99, saldo 10000', row.paid === 12999.99 && row.due === 10000, row);
    check('factura con el mismo saldo', inv.due === row.due && inv.paid === 12999.99 && inv.status === 'partially_paid', inv);
    check('2 pagos en el historial de la factura por 12999.99', invPayments[0].n === 2 && invPayments[0].total === 12999.99, invPayments);
  }

  // ---------------------------------------------------------------
  console.log('\n10. Abonar a un crédito ya pagado sigue rechazándose');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 1000);
    quiet();
    await pay(credit, 1000, {}, 'paid-1');
    let message = '';
    try { await pay(credit, 500, {}, 'paid-2'); } catch (e) { message = e?.message; }
    loud();
    check('rechazado con mensaje claro', message.includes('ya está pagado'), message);
    check('sigue con 1 abono', (await paymentCount(credit)) === 1);
  }

  // ---------------------------------------------------------------
  console.log('\n11. Agregar deuda y abonar a la vez (no se pisan)');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 10000);
    quiet();
    const { errors } = await settle<unknown>([
      credits.addAmountToCredit(credit, 3000, 'más deuda', userId),
      pay(credit, 4000, {}, 'mix-1'),
      credits.addAmountToCredit(credit, 2000, 'más deuda 2', userId),
      pay(credit, 1000, {}, 'mix-2'),
    ]);
    loud();
    const row = await creditRow(credit);
    const c = await customerRow(customer);
    check('sin errores', errors.length === 0, errors.map((e) => e?.message));
    check('saldo = 10000 + 5000 - 5000 = 10000', row.due === 10000 && row.paid === 5000, row);
    check('acumulados del cliente = deuda real', c.credit_balance === 10000 && c.current_balance === 10000, c);
  }

  // ---------------------------------------------------------------
  console.log('\n12. Saldo a favor: no se gasta dos veces');
  {
    const customer = await newCustomer();
    const creditA = await newCredit(customer, 1000);
    quiet();
    await pay(creditA, 4000, {}, 'gen-balance'); // genera 3000 de saldo a favor
    const creditB = await newCredit(customer, 3000);
    const creditC = await newCredit(customer, 3000);
    const { ok, errors } = await settle([
      credits.applyClientBalanceManually(creditB, userId),
      credits.applyClientBalanceManually(creditC, userId),
    ]);
    loud();
    const balance = (await q(`SELECT balance::float8 b FROM client_balances WHERE customer_id = $1`, [customer]))[0];
    const b = await creditRow(creditB);
    const c = await creditRow(creditC);
    check('solo 1 de las 2 aplicaciones pasa', ok.length === 1 && errors.length === 1, { ok: ok.length, errors: errors.map((e) => e?.message) });
    check('saldo a favor queda en 0 (nunca negativo)', balance.b === 0, balance);
    check('entre los dos créditos se abonaron exactamente 3000', b.paid + c.paid === 3000, { b, c });
  }

  // ---------------------------------------------------------------
  loud(); console.log('\n13. Límite de crédito: cuenta la deuda PENDIENTE, no el historial');
  {
    const customer = await newCustomer();
    await q(`UPDATE customers SET "creditLimit" = 3000000, "currentBalance" = 9999999, credit_balance = 9999999 WHERE id = $1`, [customer]);
    const customerEntity = await customersService.findOne(customer);
    quiet();
    // Historial grande ya pagado: 5 millones comprados y pagados.
    const old1 = await newCredit(customer, 2500000);
    const old2 = await newCredit(customer, 2500000);
    await pay(old1, 2500000, {}, 'hist-1');
    await pay(old2, 2500000, {}, 'hist-2');
    // Deuda pendiente actual: 2.900.000
    const open = await newCredit(customer, 2900000);
    await customersService.recalculateCreditBalances(customer, orgId);
    loud();
    check('deuda pendiente = 2.900.000 (el historial pagado no cuenta)', (await customersService.getPendingCreditDebt(customer, orgId)) === 2900000);

    let message = '';
    quiet();
    try { await credits.addAmountToCredit(open, 200000, 'más fiado', userId); } catch (e) { message = e?.message; }
    loud();
    check('agregar 200.000 se RECHAZA con mensaje claro', message.includes('LÍMITE DE CRÉDITO EXCEDIDO') && message.includes('No se guardó nada'), message);
    check('el crédito NO cambió', (await creditRow(open)).due === 2900000, await creditRow(open));
    const movements = await q(`SELECT count(*)::int n FROM credit_transactions WHERE credit_id = $1 AND type = 'debt_increase'`, [open]);
    check('no quedó ningún movimiento a medias', movements[0].n === 0, movements);

    const directCustomer = await newCustomer();
    await q(`UPDATE customers SET "creditLimit" = 100000 WHERE id = $1`, [directCustomer]);
    quiet();
    let directMessage = '';
    try {
      await credits.create({ customerId: directCustomer, originalAmount: 100001, description: 'fiado directo', skipAutoBalance: true } as any, userId);
    } catch (e) { directMessage = e?.message; }
    const directCount = await q(`SELECT count(*)::int n FROM customer_credits WHERE customer_id = $1`, [directCustomer]);
    await credits.create({ customerId: directCustomer, originalAmount: 100000, description: 'fiado directo', skipAutoBalance: true } as any, userId);
    loud();
    check('deuda directa de 100.001 con cupo 100.000 se rechaza y no se guarda', directMessage.includes('LÍMITE DE CRÉDITO EXCEDIDO') && directCount[0].n === 0, { directMessage, directCount });
    check('deuda directa de 100.000 exactos SÍ se guarda', (await customersService.getPendingCreditDebt(directCustomer, orgId)) === 100000);

    quiet();
    await credits.addAmountToCredit(open, 100000, 'justo al límite', userId);
    loud();
    check('agregar 100.000 (queda exacto en 3.000.000) SÍ pasa', (await creditRow(open)).due === 3000000, await creditRow(open));

    quiet();
    const purchase = await customersService.canMakePurchase(customer, 1);
    await pay(open, 500000, {}, 'limit-pay');
    const afterPay = await customersService.canMakePurchase(customer, 500000);
    loud();
    check('en el tope ya no puede fiar ni 1 peso', purchase.canPurchase === false && purchase.availableCredit === 0, purchase);
    check('tras abonar 500.000 vuelve a tener 500.000 de cupo', afterPay.canPurchase === true && afterPay.availableCredit === 500000, afterPay);
    void customerEntity;
  }

  // ---------------------------------------------------------------
  console.log('\n14. Dos aumentos de deuda simultáneos no pasan el límite entre los dos');
  {
    const customer = await newCustomer();
    await q(`UPDATE customers SET "creditLimit" = 1000000 WHERE id = $1`, [customer]);
    const credit = await newCredit(customer, 800000);
    quiet();
    const { ok, errors } = await settle([
      credits.addAmountToCredit(credit, 150000, 'a', userId),
      credits.addAmountToCredit(credit, 150000, 'b', userId),
    ]);
    loud();
    check('solo 1 de los 2 pasa', ok.length === 1 && errors.length === 1, { ok: ok.length, errors: errors.map((e) => e?.message) });
    check('deuda final 950.000 (no 1.100.000)', (await creditRow(credit)).due === 950000, await creditRow(credit));
  }

  // ---------------------------------------------------------------
  console.log('\n15. Movimientos reenviados por la cola offline no se aplican dos veces');
  {
    const customer = await newCustomer();
    const credit = await newCredit(customer, 10000);
    quiet();
    // Aumento de deuda enviado 6 veces a la vez + 1 reintento tardío
    await settle(Array.from({ length: 6 }, () => credits.addAmountToCredit(credit, 2500, 'más fiado', userId, 'op-add-1')));
    await credits.addAmountToCredit(credit, 2500, 'más fiado', userId, 'op-add-1');
    loud();
    const afterAdd = await creditRow(credit);
    const increases = await q(`SELECT count(*)::int n FROM credit_transactions WHERE credit_id = $1 AND type = 'debt_increase'`, [credit]);
    check('aumento de 2.500 aplicado UNA sola vez (saldo 12.500)', afterAdd.due === 12500 && increases[0].n === 1, { afterAdd, increases });

    quiet();
    // Saldo a favor de 3.000 y aplicación reenviada
    const helper = await newCredit(customer, 1000);
    await pay(helper, 4000, {}, 'op-gen-balance');
    await settle(Array.from({ length: 4 }, () => credits.applyClientBalanceManually(credit, userId, 2000, 'op-apply-1')));
    await credits.applyClientBalanceManually(credit, userId, 2000, 'op-apply-1');
    loud();
    const afterApply = await creditRow(credit);
    const balance = (await q(`SELECT balance::float8 b FROM client_balances WHERE customer_id = $1`, [customer]))[0];
    check('saldo a favor aplicado UNA sola vez (crédito 10.500, quedan 1.000 a favor)', afterApply.due === 10500 && balance.b === 1000, { afterApply, balance });

    quiet();
    // Cancelación reenviada
    const toCancel = await newCredit(customer, 5000);
    await credits.cancel(toCancel);
    let cancelError = '';
    try { await credits.cancel(toCancel); } catch (e) { cancelError = e?.message; }
    loud();
    check('cancelar dos veces no da error (reenvío) y queda cancelado', cancelError === '' && (await creditRow(toCancel)).status === 'cancelled', cancelError);
    const c = await customerRow(customer);
    check('acumulados del cliente = deuda real', c.credit_balance === c.real_debt && c.current_balance === c.real_debt, c);
  }

  // ---------------------------------------------------------------
  console.log('\n16. Hora del abono: reloj del negocio, no UTC (cuadre de caja)');
  {
    await q(`UPDATE organizations SET timezone = 'America/Caracas' WHERE id = $1`, [orgId]);
    const customer = await newCustomer();
    const credit = await newCredit(customer, 300000);
    quiet();
    // App anterior: manda la hora local SIN zona (08:22 de la mañana en Caracas)
    const naive = await pay(credit, 140000, { paymentDate: '2026-10-13T08:22:11.243' }, 'idem_tz_1');
    // App nueva: manda el instante exacto en UTC
    const exact = await pay(credit, 25000, { paymentDate: '2026-10-13T14:45:54.174Z' }, 'tz-exact');
    loud();
    const stored = await q(`SELECT amount::float8 a, payment_date FROM credit_payments WHERE credit_id = $1 ORDER BY amount DESC`, [credit]);
    check('08:22 en Caracas se guarda como 12:22 UTC (antes quedaba 08:22 UTC = 04:22 local)', new Date(stored[0].payment_date).toISOString() === '2026-10-13T12:22:11.243Z', stored[0]);
    check('una hora que ya trae zona se guarda igual', new Date(stored[1].payment_date).toISOString() === '2026-10-13T14:45:54.174Z', stored[1]);

    // Caja abierta a las 08:07 hora local (12:07 UTC): los dos abonos deben entrar al turno
    const inShift = await q(
      `SELECT count(*)::int n, COALESCE(SUM(amount),0)::float8 total FROM credit_payments
        WHERE credit_id = $1 AND payment_method = 'cash'
          AND payment_date >= '2026-10-13T12:07:48.713Z' AND payment_date <= '2026-10-14T02:00:00Z'`,
      [credit],
    );
    check('los dos abonos caen dentro del turno de caja abierto a las 08:07', inShift[0].n === 2 && inShift[0].total === 165000, inShift);

    quiet();
    // Reenvío del abono de la app anterior con otra clave automática: no se duplica
    const again = await pay(credit, 140000, { paymentDate: '2026-10-13T08:22:11.243' }, 'idem_tz_2');
    loud();
    check('el reenvío del abono antiguo no se duplica', again.idempotent === true && (await paymentCount(credit)) === 2, { idempotent: again.idempotent, n: await paymentCount(credit) });
    void naive; void exact;
  }

  loud();
  await dataSource.destroy();
  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} VERIFICACIONES FALLARON`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR INESPERADO:', error);
  process.exit(1);
});
