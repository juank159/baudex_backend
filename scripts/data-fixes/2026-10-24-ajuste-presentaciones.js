#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * =============================================================================
 * Ajuste de inventario: ventas por PRESENTACIÓN que descontaron unidades sueltas
 * =============================================================================
 *
 * QUÉ PASÓ
 *   Las ventas hechas SIN internet con presentación (caja, cartón, paca...) se
 *   subían al servidor sin la presentación: vender 1 cartón de 30 huevos
 *   descontaba 1 huevo. El sistema quedó con MÁS inventario del real.
 *   (Corregido en la app: frontend fe51d52.)
 *
 * QUÉ HACE
 *   Por cada producto afectado registra UN ajuste negativo con el mismo
 *   servicio de inventario del backend (InventoryService.registerAdjustment):
 *   consume lotes PEPS/FIFO, deja el movimiento en el kardex y actualiza el
 *   stock. No toca facturas, pagos ni caja.
 *
 *   Unidades a descontar por línea de venta = (cantidad − devuelta con nota
 *   crédito) × (factor de la presentación − 1).
 *
 * SEGURIDAD
 *   - Por defecto SOLO MUESTRA el plan (no cambia nada). Para aplicar: --aplicar
 *   - No se aplica dos veces: cada ajuste guarda las líneas de venta que
 *     corrige; al volver a correrlo solo toma líneas nuevas.
 *   - Por defecto solo toma líneas donde el precio cobrado = precio de la
 *     presentación (casos seguros). --incluir-dudosos agrega las demás.
 *   - Si al producto no le alcanza el stock, NO se ajusta: hay que contarlo.
 *   - No levanta el servidor completo (ni tareas programadas, ni migraciones).
 *
 * USO (desde la carpeta backend, con .env apuntando a la base correcta)
 *   npm run build
 *   node scripts/data-fixes/2026-10-24-ajuste-presentaciones.js \
 *        --negocio "Mercaexpress" --usuario castrokely09@gmail.com
 *   # revisar el plan y el CSV que deja en backups/, sacar respaldo, y luego:
 *   node scripts/data-fixes/2026-10-24-ajuste-presentaciones.js \
 *        --negocio "Mercaexpress" --usuario castrokely09@gmail.com --aplicar
 * =============================================================================
 */
const fs = require('node:fs');
const path = require('node:path');

const TAG = 'AJUSTE-PRESENTACIONES-2026-10';

function parseArgs(argv) {
  const args = { aplicar: false, incluirDudosos: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--aplicar') args.aplicar = true;
    else if (a === '--incluir-dudosos') args.incluirDudosos = true;
    else if (a === '--negocio') args.negocio = argv[++i];
    else if (a === '--usuario') args.usuario = argv[++i];
    else {
      console.error(`Opción desconocida: ${a}`);
      process.exit(1);
    }
  }
  if (!args.negocio || !args.usuario) {
    console.error('Uso: --negocio "<nombre>" --usuario <email> [--incluir-dudosos] [--aplicar]');
    process.exit(1);
  }
  return args;
}

// Líneas de venta afectadas aún no corregidas por este ajuste.
const AFFECTED_LINES_SQL = `
WITH devuelto AS (
  SELECT cni.invoice_item_id, SUM(cni.quantity) AS cantidad
  FROM credit_note_items cni
  JOIN credit_notes cn ON cn.id = cni.credit_note_id
  WHERE cni.deleted_at IS NULL
    AND cn.deleted_at IS NULL
    AND cn.status = 'confirmed'
    AND cn.inventory_restored = true
    AND cni.invoice_item_id IS NOT NULL
  GROUP BY cni.invoice_item_id
),
ya_ajustado AS (
  SELECT DISTINCT x.item_id
  FROM inventory_movements m,
       LATERAL json_array_elements_text(
         m.metadata -> 'ajustePresentaciones' -> 'invoiceItemIds'
       ) AS x(item_id)
  WHERE m.organization_id = $1
    AND m.deleted_at IS NULL
    AND m.metadata ->> 'tag' = '${TAG}'
)
SELECT
  ii.id                       AS invoice_item_id,
  ii."productId"              AS product_id,
  ii.description              AS producto,
  i.number                    AS factura,
  ii.unit                     AS presentacion,
  pp.factor::float            AS factor,
  ii.quantity::float          AS cantidad,
  COALESCE(d.cantidad, 0)::float AS devuelto,
  (ABS(ii."unitPrice" - pp.price) < 1) AS precio_coincide
FROM invoice_items ii
JOIN invoices i ON i.id = ii."invoiceId"
JOIN product_presentations pp
  ON pp.product_id = ii."productId"
 AND pp.deleted_at IS NULL
 AND LOWER(TRIM(pp.name)) = LOWER(TRIM(ii.unit))
 AND pp.factor > 1
LEFT JOIN devuelto d ON d.invoice_item_id = ii.id
WHERE i.organization_id = $1
  AND i.deleted_at IS NULL
  AND i.status <> 'cancelled'
  AND ii.deleted_at IS NULL
  AND ii."productId" IS NOT NULL
  AND ii.presentation_id IS NULL
  AND ii.id::text NOT IN (SELECT item_id FROM ya_ajustado)
ORDER BY ii.description, i.number`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.env.MIGRATIONS_RUN_ON_STARTUP = 'false';

  const dist = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(path.join(dist, 'database', 'typeorm.config.js'))) {
    console.error('No existe dist/. Corre `npm run build` antes.');
    process.exit(1);
  }

  const dataSource = require(path.join(dist, 'database', 'typeorm.config.js')).default;
  const { InventoryService } = require(path.join(dist, 'inventory', 'services', 'inventory.service.js'));
  const { InventoryMovement } = require(path.join(dist, 'inventory', 'entities', 'inventory-movement.entity.js'));
  const { InventoryBatch } = require(path.join(dist, 'inventory', 'entities', 'inventory-batch.entity.js'));
  const { InventoryBatchMovement } = require(path.join(dist, 'inventory', 'entities', 'inventory-batch-movement.entity.js'));
  const { Product } = require(path.join(dist, 'products', 'entities', 'product.entity.js'));

  await dataSource.initialize();
  try {
    const [org] = await dataSource.query(
      `SELECT id, name, "mainWarehouseId" AS main_warehouse_id
         FROM organizations WHERE name ILIKE $1 AND deleted_at IS NULL`,
      [args.negocio],
    );
    if (!org) throw new Error(`No se encontró el negocio "${args.negocio}"`);
    const [user] = await dataSource.query(
      `SELECT id, email FROM users
        WHERE LOWER(email) = LOWER($1) AND organization_id = $2 AND deleted_at IS NULL`,
      [args.usuario, org.id],
    );
    if (!user) throw new Error(`El usuario ${args.usuario} no pertenece a ${org.name}`);
    let warehouseId = org.main_warehouse_id;
    if (!warehouseId) {
      const [w] = await dataSource.query(
        `SELECT id FROM warehouses WHERE organization_id = $1 AND "isMainWarehouse" = true
           AND "isActive" = true AND deleted_at IS NULL LIMIT 1`,
        [org.id],
      );
      warehouseId = w && w.id;
    }
    if (!warehouseId) throw new Error(`${org.name} no tiene almacén principal`);

    const lines = await dataSource.query(AFFECTED_LINES_SQL, [org.id]);
    const chosen = lines.filter((l) => args.incluirDudosos || l.precio_coincide);

    // Agrupar por producto.
    const byProduct = new Map();
    for (const l of chosen) {
      const units = Math.round((l.cantidad - l.devuelto) * (l.factor - 1) * 100) / 100;
      if (units <= 0) continue;
      const p = byProduct.get(l.product_id) || {
        productId: l.product_id, producto: l.producto, unidades: 0, itemIds: [], facturas: [],
      };
      p.unidades = Math.round((p.unidades + units) * 100) / 100;
      p.itemIds.push(l.invoice_item_id);
      p.facturas.push(l.factura);
      byProduct.set(l.product_id, p);
    }

    const plan = [...byProduct.values()];
    if (plan.length) {
      const stocks = await dataSource.query(
        `SELECT id, stock::float AS stock FROM products WHERE id = ANY($1::uuid[])`,
        [plan.map((p) => p.productId)],
      );
      const stockById = new Map(stocks.map((s) => [s.id, s.stock]));
      for (const p of plan) {
        p.stockActual = stockById.get(p.productId) ?? 0;
        p.stockNuevo = Math.round((p.stockActual - p.unidades) * 100) / 100;
        p.estado = p.stockNuevo < 0 ? 'CONTAR A MANO (no alcanza el stock)' : 'listo';
      }
    }

    const dudosas = lines.length - lines.filter((l) => l.precio_coincide).length;
    console.log(`\nNegocio: ${org.name}   Usuario: ${user.email}`);
    console.log(`Líneas afectadas sin corregir: ${lines.length} (${dudosas} dudosas${args.incluirDudosos ? ', incluidas' : ', NO incluidas'})\n`);
    console.table(plan.map((p) => ({
      producto: p.producto,
      lineas: p.itemIds.length,
      'stock actual': p.stockActual,
      'a descontar': p.unidades,
      'stock nuevo': p.stockNuevo,
      estado: p.estado,
    })));

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = path.join(__dirname, '..', '..', '..', 'backups', `ajuste-presentaciones-${stamp}.csv`);
    const csv = ['producto,product_id,lineas,stock_actual,a_descontar,stock_nuevo,estado,facturas']
      .concat(plan.map((p) => [
        JSON.stringify(p.producto), p.productId, p.itemIds.length, p.stockActual,
        p.unidades, p.stockNuevo, JSON.stringify(p.estado), JSON.stringify(p.facturas.join(' ')),
      ].join(',')))
      .join('\n');
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(csvPath, csv + '\n');
    console.log(`Plan guardado en ${csvPath}`);

    if (!args.aplicar) {
      console.log('\nSOLO REVISIÓN: no se cambió nada. Para aplicar agregue --aplicar (saque respaldo antes).');
      return;
    }

    // Notificaciones apagadas: es una corrección, no una operación del día.
    const silentNotifications = new Proxy({}, { get: () => async () => undefined });
    const inventory = new InventoryService(
      dataSource.getRepository(InventoryMovement),
      dataSource.getRepository(InventoryBatch),
      dataSource.getRepository(InventoryBatchMovement),
      dataSource.getRepository(Product),
      dataSource,
      silentNotifications,
    );

    let ok = 0;
    for (const p of plan.filter((x) => x.estado === 'listo')) {
      const notes =
        `[${TAG}] Corrección: ventas por presentación sin internet descontaron ` +
        `unidades sueltas (${p.itemIds.length} líneas: ${p.facturas.join(', ')})`;
      try {
        const movement = await inventory.registerAdjustment(
          p.productId,
          -p.unidades,
          notes,
          org.id,
          user.id,
          undefined,
          {
            notes,
            warehouseId,
            tag: TAG,
            ajustePresentaciones: { invoiceItemIds: p.itemIds },
          },
        );
        ok++;
        console.log(`✔ ${p.producto}: −${p.unidades} (movimiento ${movement.movementNumber})`);
      } catch (e) {
        console.error(`✘ ${p.producto}: ${e.message}`);
      }
    }
    const skipped = plan.length - plan.filter((x) => x.estado === 'listo').length;
    console.log(`\nAplicados: ${ok}. Sin aplicar por falta de stock: ${skipped}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
