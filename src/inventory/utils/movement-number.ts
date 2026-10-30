import { EntityManager, QueryRunner } from 'typeorm';
import { tenantWallClockNow } from '../../common/utils/tenant-clock';

/**
 * Siguiente número de movimiento del mes (`MOV-AAAAMM-000123`) del negocio.
 *
 * Antes se leían TODOS los movimientos del mes para buscar el mayor (miles
 * de filas por cada producto vendido: cada venta era más lenta que la
 * anterior). Ahora se pide solo el mayor, usando el índice único
 * (organizationId, movementNumber). El candado por negocio dura hasta el fin
 * de la transacción: dos ventas a la vez no sacan el mismo número. Ventas y
 * creación de productos usan este mismo candado.
 */
export async function nextMovementNumber(
  organizationId: string,
  runner: QueryRunner | EntityManager,
): Promise<string> {
  await lockInventory(organizationId, runner);
  return nextSequenceNumber(
    runner,
    organizationId,
    'MOV',
    'inventory_movements',
    '"movementNumber"',
  );
}

/**
 * Siguiente número de lote del mes (`BATCH-AAAAMM-000123`). Mismo orden de
 * candados que las ventas (inventario → lotes) para no bloquearse entre sí.
 */
export async function nextBatchNumber(
  organizationId: string,
  runner: QueryRunner | EntityManager,
): Promise<string> {
  await lockInventory(organizationId, runner);
  await runner.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `batch_number_${organizationId}`,
  ]);
  return nextSequenceNumber(
    runner,
    organizationId,
    'BATCH',
    'inventory_batches',
    '"batchNumber"',
  );
}

/**
 * Candado de inventario del negocio, hasta el fin de la transacción. Una
 * venta lo toma ANTES de tocar lotes: si lo tomara después (al numerar el
 * movimiento), dos ventas de los mismos productos podían quedar esperándose
 * una a la otra (deadlock) y una fallaba. Tomarlo dos veces no hace daño.
 */
export async function lockInventory(
  organizationId: string,
  runner: QueryRunner | EntityManager,
): Promise<void> {
  await runner.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `movement_number_${organizationId}`,
  ]);
}

async function nextSequenceNumber(
  runner: QueryRunner | EntityManager,
  organizationId: string,
  kind: string,
  table: string,
  column: string,
): Promise<string> {
  const now = tenantWallClockNow();
  const prefix = `${kind}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  // Solo números de 6 dígitos (los de respaldo tienen otra forma). Con
  // ceros a la izquierda, el orden de texto es el orden numérico.
  const rows: Array<{ value: string }> = await runner.query(
    `SELECT ${column} AS value FROM ${table}
     WHERE organization_id = $1 AND ${column} ~ $2
     ORDER BY ${column} DESC
     LIMIT 1`,
    [organizationId, `^${prefix}[0-9]{6}$`],
  );
  const last = rows[0]?.value;
  const lastSequence = last ? parseInt(last.substring(prefix.length), 10) : 0;
  return `${prefix}${String(lastSequence + 1).padStart(6, '0')}`;
}
