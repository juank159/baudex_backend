/**
 * Prueba de integración del registro global de idempotencia
 * (IdempotencyInterceptor) contra un PostgreSQL REAL.
 *
 * Uso (base DESECHABLE con migraciones aplicadas):
 *   DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=x \
 *   DB_NAME=baudex_test DB_SSL=false \
 *   npx ts-node --transpile-only -r tsconfig-paths/register test/idempotency.interceptor.integration.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { firstValueFrom, defer } from 'rxjs';
import { randomUUID } from 'crypto';
import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';

const dbName = process.env.DB_NAME || '';
if (!dbName.endsWith('_test')) {
  console.error(`ABORTADO: DB_NAME="${dbName}" no termina en "_test".`);
  process.exit(2);
}

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  }
}

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: dbName,
    synchronize: false,
    logging: false,
    extra: { max: 30 },
  });
  await dataSource.initialize();
  const interceptor = new IdempotencyInterceptor(dataSource);
  (interceptor as any).logger = { log: () => undefined, error: console.error };

  const orgA = randomUUID();
  const orgB = randomUUID();
  const userId = randomUUID();

  /** Simula una petición HTTP pasando por el interceptor. */
  const call = (opts: {
    key?: string;
    method?: string;
    path?: string;
    org?: string;
    handler: () => Promise<any>;
  }) => {
    const headers: Record<string, string> = {};
    if (opts.key) headers['idempotency-key'] = opts.key;
    const req = {
      method: opts.method ?? 'POST',
      originalUrl: opts.path ?? '/invoices',
      headers,
      get: (name: string) => headers[name.toLowerCase()],
      user: { id: userId, organizationId: opts.org ?? orgA },
      tenant: { id: opts.org ?? orgA },
    };
    const context: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
    const next: any = { handle: () => defer(() => opts.handler()) };
    return firstValueFrom(interceptor.intercept(context, next));
  };
  const settle = async (ps: Promise<any>[]) => {
    const r = await Promise.allSettled(ps);
    return {
      ok: r.filter((x) => x.status === 'fulfilled').map((x: any) => x.value),
      errors: r.filter((x) => x.status === 'rejected').map((x: any) => x.reason),
    };
  };
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  console.log('\n1. Reenvío de una operación ya confirmada');
  {
    let executions = 0;
    const handler = async () => { executions++; return { id: 'factura-1', total: 8500, n: executions }; };
    const first = await call({ key: 'op-1', handler });
    const second = await call({ key: 'op-1', handler });
    const third = await call({ key: 'op-1', handler });
    check('se ejecuta UNA sola vez', executions === 1, executions);
    check('los reenvíos reciben la misma respuesta', JSON.stringify(second) === JSON.stringify(first) && third.id === 'factura-1', { first, second });
  }

  console.log('\n2. La misma operación enviada 15 veces a la vez');
  {
    let executions = 0;
    const handler = async () => { executions++; await sleep(150); return { id: 'gasto-1' }; };
    const { ok, errors } = await settle(Array.from({ length: 15 }, () => call({ key: 'op-2', handler })));
    check('se ejecuta UNA sola vez', executions === 1, executions);
    check('ninguna respuesta distinta a la original', ok.every((r) => r.id === 'gasto-1'));
    check('las que llegaron mientras se procesaba reciben 425 (reintentable)', errors.every((e) => e?.getStatus?.() === 425), errors.map((e) => e?.message));
    const retry = await call({ key: 'op-2', handler });
    check('al reintentar reciben la respuesta guardada, sin ejecutar', retry.id === 'gasto-1' && executions === 1, executions);
  }

  console.log('\n3. Si la operación falla, el reintento se vuelve a evaluar');
  {
    let executions = 0;
    let cajaAbierta = false;
    const handler = async () => {
      executions++;
      if (!cajaAbierta) throw new Error('No hay una caja abierta');
      return { id: 'venta-efectivo' };
    };
    let message = '';
    try { await call({ key: 'op-3', handler }); } catch (e) { message = e?.message; }
    check('el error original llega tal cual', message === 'No hay una caja abierta', message);
    cajaAbierta = true;
    const retry = await call({ key: 'op-3', handler });
    check('el reintento SÍ se ejecuta y queda guardado', retry.id === 'venta-efectivo' && executions === 2, executions);
    await call({ key: 'op-3', handler });
    check('y a partir de ahí ya no se repite', executions === 2, executions);
  }

  console.log('\n4. La clave es por organización, método y ruta');
  {
    let executions = 0;
    const handler = async () => ({ n: ++executions });
    await call({ key: 'op-4', handler });
    await call({ key: 'op-4', org: orgB, handler });
    await call({ key: 'op-4', path: '/expenses', handler });
    await call({ key: 'op-4', method: 'PATCH', handler });
    check('otra organización, otra ruta u otro método se ejecutan aparte', executions === 4, executions);
    await call({ key: 'op-4', path: '/invoices?x=1', handler });
    check('los parámetros de consulta no cambian la operación', executions === 4, executions);
  }

  console.log('\n5. Lo que NO debe tocar');
  {
    let executions = 0;
    const handler = async () => ({ n: ++executions });
    await call({ handler });
    await call({ handler });
    check('peticiones sin clave se ejecutan siempre', executions === 2, executions);
    await call({ key: 'op-5', method: 'GET', handler });
    await call({ key: 'op-5', method: 'GET', handler });
    check('las consultas (GET) se ejecutan siempre', executions === 4, executions);
    await call({ key: 'op-5', path: '/auth/login', handler });
    await call({ key: 'op-5', path: '/auth/login', handler });
    check('las rutas de autenticación se ejecutan siempre', executions === 6, executions);
  }

  console.log('\n6. Respuestas especiales');
  {
    let executions = 0;
    const first = await call({ key: 'op-6', handler: async () => { executions++; return undefined; } });
    const second = await call({ key: 'op-6', handler: async () => { executions++; return undefined; } });
    check('respuesta vacía también se recuerda', executions === 1 && first === undefined && (second === undefined || second === null), { executions, second });
    const list = await call({ key: 'op-6b', handler: async () => [{ a: 1 }, { a: 2 }] });
    const listAgain = await call({ key: 'op-6b', handler: async () => [] });
    check('listas y decimales se devuelven igual', JSON.stringify(listAgain) === JSON.stringify(list), listAgain);
  }

  console.log('\n7. Operación que quedó a medias porque el servidor se detuvo');
  {
    let executions = 0;
    const handler = async () => ({ n: ++executions });
    // Simular una fila "processing" huérfana de hace 10 minutos
    const { createHash } = await import('crypto');
    const keyHash = createHash('sha256').update('POST|/invoices|op-7').digest('hex');
    await dataSource.query(
      `INSERT INTO idempotency_keys (organization_id, key_hash, method, path, status, created_at)
       VALUES ($1, $2, 'POST', '/invoices', 'processing', now() - interval '10 minutes')`,
      [orgA, keyHash],
    );
    const { ok, errors } = await settle(Array.from({ length: 5 }, () => call({ key: 'op-7', handler })));
    check('se retoma y se ejecuta UNA sola vez', executions === 1, { executions, ok: ok.length, errors: errors.length });
  }

  await dataSource.query(`DELETE FROM idempotency_keys WHERE organization_id IN ($1, $2)`, [orgA, orgB]);
  await dataSource.destroy();
  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} VERIFICACIONES FALLARON`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR INESPERADO:', error);
  process.exit(1);
});
