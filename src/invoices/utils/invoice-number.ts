import { EntityManager } from 'typeorm';
import { tenantWallClockNow } from '../../common/utils/tenant-clock';
import { lockInventory } from '../../inventory/utils/movement-number';

/**
 * Número de factura libre con el formato de siempre (`INV-2026-455009`).
 *
 * Antes se tomaban los últimos 6 dígitos del reloj sin revisar: el número
 * es único en TODO el servidor (todos los negocios), así que a medida que
 * el año se llena de facturas una venta nueva podía caer en un número ya
 * usado y el servidor la rechazaba. Ahora se revisa que esté libre, con el
 * candado de inventario del NEGOCIO (el mismo que toma cada venta): dos
 * ventas del mismo negocio a la vez no sacan el mismo número, y los otros
 * negocios no esperan.
 */
export async function nextInvoiceNumber(
  manager: EntityManager,
  organizationId: string,
  now: Date = new Date(),
): Promise<string> {
  await lockInventory(organizationId, manager);
  const year = tenantWallClockNow(now).getFullYear();
  let candidate = Number(now.getTime().toString().slice(-6));
  for (let attempt = 0; attempt < 50; attempt++) {
    const number = `INV-${year}-${String(candidate).padStart(6, '0')}`;
    const taken = await manager.query(
      `SELECT 1 FROM invoices WHERE number = $1 LIMIT 1`,
      [number],
    );
    if (taken.length === 0) return number;
    candidate = Math.floor(Math.random() * 1_000_000);
  }
  // Prácticamente imposible: 50 números seguidos ocupados.
  return `INV-${year}-${now.getTime()}`;
}
