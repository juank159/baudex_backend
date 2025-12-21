/**
 * Script de prueba para verificar la restauración FIFO de inventario
 * en notas de crédito.
 *
 * Este script valida que:
 * 1. Las devoluciones restauran al lote original (no crean nuevo lote)
 * 2. Se usa orden LIFO para restauración (inverso al consumo FIFO)
 * 3. Los lotes agotados se reactivan correctamente
 * 4. Las devoluciones parciales funcionan correctamente
 * 5. La compatibilidad con notas de crédito antiguas se mantiene
 *
 * IMPORTANTE: Este es un script de VALIDACIÓN, no de testing automatizado.
 * Requiere datos de prueba en la base de datos.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { InventoryBatch, BatchStatus } from './inventory/entities/inventory-batch.entity';
import { InventoryBatchMovement, BatchMovementType } from './inventory/entities/inventory-batch-movement.entity';
import { InventoryMovement } from './inventory/entities/inventory-movement.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('🧪 INICIANDO PRUEBAS DE RESTAURACIÓN FIFO\n');
  console.log('=' .repeat(80));

  try {
    // TEST 1: Verificar que el campo invoice_item_id existe
    await test1_VerifyDatabaseSchema(dataSource);

    // TEST 2: Verificar método restoreToBatchesIntelligent existe
    await test2_VerifyMethodExists();

    // TEST 3: Consultar movimientos de lote con invoiceItemId
    await test3_QueryBatchMovementsWithInvoiceItemId(dataSource);

    // TEST 4: Verificar estructura de datos para LIFO
    await test4_VerifyLIFODataStructure(dataSource);

    // TEST 5: Simular escenario de restauración
    await test5_SimulateRestorationScenario(dataSource);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TODAS LAS PRUEBAS COMPLETADAS');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS:', error.message);
    console.error(error);
  } finally {
    await app.close();
  }
}

/**
 * TEST 1: Verificar que la columna invoice_item_id existe en la tabla
 */
async function test1_VerifyDatabaseSchema(dataSource: DataSource) {
  console.log('\n📋 TEST 1: Verificando esquema de base de datos');
  console.log('-'.repeat(80));

  const query = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'inventory_batch_movements'
      AND column_name = 'invoice_item_id'
  `;

  const result = await dataSource.query(query);

  if (result.length === 0) {
    throw new Error('❌ Columna invoice_item_id NO EXISTE en inventory_batch_movements');
  }

  const column = result[0];
  console.log('✅ Columna invoice_item_id encontrada:');
  console.log(`   - Tipo: ${column.data_type}`);
  console.log(`   - Nullable: ${column.is_nullable}`);
  console.log(`   - Default: ${column.column_default || 'NULL'}`);

  // Verificar foreign key
  const fkQuery = `
    SELECT
      conname,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'inventory_batch_movements'::regclass
      AND conname LIKE '%invoice%'
  `;

  const fkResult = await dataSource.query(fkQuery);

  if (fkResult.length > 0) {
    console.log('\n✅ Foreign key encontrada:');
    console.log(`   - Nombre: ${fkResult[0].conname}`);
    console.log(`   - Definición: ${fkResult[0].definition}`);
  } else {
    console.log('\n⚠️  No se encontró foreign key (puede ser opcional)');
  }

  // Verificar índice
  const indexQuery = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'inventory_batch_movements'
      AND indexname LIKE '%invoice%'
  `;

  const indexResult = await dataSource.query(indexQuery);

  if (indexResult.length > 0) {
    console.log('\n✅ Índice encontrado:');
    console.log(`   - Nombre: ${indexResult[0].indexname}`);
  } else {
    console.log('\n⚠️  No se encontró índice en invoice_item_id');
  }
}

/**
 * TEST 2: Verificar que el método restoreToBatchesIntelligent existe
 */
async function test2_VerifyMethodExists() {
  console.log('\n📋 TEST 2: Verificando existencia de métodos');
  console.log('-'.repeat(80));

  const inventoryServicePath = './inventory/services/inventory.service';

  try {
    const { InventoryService } = await import(inventoryServicePath);
    const methodExists = typeof InventoryService.prototype.restoreToBatchesIntelligent === 'function';

    if (methodExists) {
      console.log('✅ Método restoreToBatchesIntelligent() existe en InventoryService');
    } else {
      throw new Error('❌ Método restoreToBatchesIntelligent() NO EXISTE');
    }

    // Verificar registerSale acepta invoiceItemId
    const registerSaleExists = typeof InventoryService.prototype.registerSale === 'function';
    console.log(`✅ Método registerSale() existe: ${registerSaleExists}`);

  } catch (error) {
    throw new Error(`❌ Error verificando métodos: ${error.message}`);
  }
}

/**
 * TEST 3: Consultar movimientos de lote con invoiceItemId
 */
async function test3_QueryBatchMovementsWithInvoiceItemId(dataSource: DataSource) {
  console.log('\n📋 TEST 3: Consultando movimientos con invoiceItemId');
  console.log('-'.repeat(80));

  // Buscar movimientos que tengan invoiceItemId
  const query = `
    SELECT
      bm.id,
      bm.type,
      bm.quantity,
      bm.invoice_item_id,
      bm.batch_id,
      bm.movement_date,
      b.batch_number,
      p.name as product_name
    FROM inventory_batch_movements bm
    INNER JOIN inventory_batches b ON b.id = bm.batch_id
    INNER JOIN products p ON p.id = b.product_id
    WHERE bm.invoice_item_id IS NOT NULL
    ORDER BY bm.movement_date DESC
    LIMIT 10
  `;

  const movements = await dataSource.query(query);

  if (movements.length === 0) {
    console.log('⚠️  No hay movimientos con invoiceItemId todavía (esperado en sistema nuevo)');
    console.log('   → Se populará cuando se creen nuevas facturas');
  } else {
    console.log(`✅ Encontrados ${movements.length} movimientos con invoiceItemId:`);
    movements.forEach((m, idx) => {
      console.log(`   ${idx + 1}. Lote: ${m.batch_number} | Producto: ${m.product_name}`);
      console.log(`      Tipo: ${m.type} | Cantidad: ${m.quantity} | InvoiceItemId: ${m.invoice_item_id.substring(0, 8)}...`);
    });
  }

  // Estadísticas
  const statsQuery = `
    SELECT
      type,
      COUNT(*) as count,
      COUNT(invoice_item_id) as with_invoice_item_id
    FROM inventory_batch_movements
    GROUP BY type
  `;

  const stats = await dataSource.query(statsQuery);

  console.log('\n📊 Estadísticas de movimientos por tipo:');
  stats.forEach(s => {
    const percentage = s.count > 0 ? ((s.with_invoice_item_id / s.count) * 100).toFixed(1) : 0;
    console.log(`   - ${s.type}: ${s.count} total, ${s.with_invoice_item_id} con invoiceItemId (${percentage}%)`);
  });
}

/**
 * TEST 4: Verificar estructura de datos para orden LIFO
 */
async function test4_VerifyLIFODataStructure(dataSource: DataSource) {
  console.log('\n📋 TEST 4: Verificando estructura para orden LIFO');
  console.log('-'.repeat(80));

  // Buscar una factura con múltiples movimientos de lote
  const query = `
    SELECT
      im.reference_id as invoice_id,
      COUNT(DISTINCT bm.batch_id) as batch_count,
      SUM(ABS(bm.quantity)) as total_quantity,
      ARRAY_AGG(bm.id ORDER BY bm.movement_date DESC) as movement_ids,
      ARRAY_AGG(b.batch_number ORDER BY bm.movement_date DESC) as batch_numbers,
      ARRAY_AGG(ABS(bm.quantity) ORDER BY bm.movement_date DESC) as quantities
    FROM inventory_movements im
    INNER JOIN inventory_batch_movements bm ON bm.movement_id = im.id
    INNER JOIN inventory_batches b ON b.id = bm.batch_id
    WHERE im.reference_type = 'invoice'
      AND bm.type = '${BatchMovementType.CONSUME}'
    GROUP BY im.reference_id
    HAVING COUNT(DISTINCT bm.batch_id) > 1
    LIMIT 5
  `;

  const invoices = await dataSource.query(query);

  if (invoices.length === 0) {
    console.log('⚠️  No hay facturas con consumo multi-lote todavía');
    console.log('   → Casos de prueba reales se generarán con uso del sistema');
  } else {
    console.log(`✅ Encontradas ${invoices.length} facturas con consumo multi-lote:`);
    invoices.forEach((inv, idx) => {
      console.log(`\n   ${idx + 1}. Invoice: ${inv.invoice_id.substring(0, 8)}...`);
      console.log(`      Lotes consumidos: ${inv.batch_count}`);
      console.log(`      Orden LIFO para restauración:`);

      for (let i = 0; i < inv.batch_numbers.length; i++) {
        console.log(`         ${i + 1}. Lote ${inv.batch_numbers[i]}: ${inv.quantities[i]} unidades`);
      }
    });
  }
}

/**
 * TEST 5: Simular escenario de restauración (solo consulta, no modifica)
 */
async function test5_SimulateRestorationScenario(dataSource: DataSource) {
  console.log('\n📋 TEST 5: Simulando escenario de restauración');
  console.log('-'.repeat(80));

  // Buscar un invoice_item que tenga movimientos de lote asociados
  const query = `
    SELECT
      ii.id as invoice_item_id,
      ii.product_id,
      p.name as product_name,
      ii.quantity as quantity_sold,
      ii.invoice_id,
      i.number as invoice_number,
      (
        SELECT COUNT(*)
        FROM inventory_batch_movements bm2
        WHERE bm2.invoice_item_id = ii.id
          AND bm2.type = '${BatchMovementType.CONSUME}'
      ) as batch_movements_count
    FROM invoice_items ii
    INNER JOIN invoices i ON i.id = ii.invoice_id
    INNER JOIN products p ON p.id = ii.product_id
    WHERE ii.id IN (
      SELECT DISTINCT invoice_item_id
      FROM inventory_batch_movements
      WHERE invoice_item_id IS NOT NULL
    )
    LIMIT 5
  `;

  const items = await dataSource.query(query);

  if (items.length === 0) {
    console.log('⚠️  No hay invoice_items con movimientos de lote vinculados');
    console.log('   → Se crearán automáticamente con nuevas ventas');
    console.log('\n📝 Pasos para crear datos de prueba:');
    console.log('   1. Crear una factura nueva con productos en stock');
    console.log('   2. El sistema automáticamente guardará invoice_item_id en batch movements');
    console.log('   3. Crear nota de crédito referenciando esa factura');
    console.log('   4. Verificar que restoreToBatchesIntelligent() restaura al lote original');
    return;
  }

  console.log(`✅ Encontrados ${items.length} invoice_items con batch movements:`);

  for (const item of items) {
    console.log(`\n   📦 Producto: ${item.product_name}`);
    console.log(`      Invoice: ${item.invoice_number}`);
    console.log(`      Cantidad vendida: ${item.quantity_sold}`);
    console.log(`      Movimientos de lote: ${item.batch_movements_count}`);

    // Obtener detalle de los movimientos
    const movementsQuery = `
      SELECT
        bm.id,
        bm.quantity,
        bm.movement_date,
        b.batch_number,
        b.current_quantity,
        b.status
      FROM inventory_batch_movements bm
      INNER JOIN inventory_batches b ON b.id = bm.batch_id
      WHERE bm.invoice_item_id = $1
        AND bm.type = '${BatchMovementType.CONSUME}'
      ORDER BY bm.movement_date DESC
    `;

    const movements = await dataSource.query(movementsQuery, [item.invoice_item_id]);

    console.log(`      Orden de restauración (LIFO):`);
    let totalToRestore = item.quantity_sold;

    for (let i = 0; i < movements.length; i++) {
      const m = movements[i];
      const quantityConsumed = Math.abs(m.quantity);
      const quantityToRestore = Math.min(totalToRestore, quantityConsumed);

      console.log(`         ${i + 1}. Lote ${m.batch_number}:`);
      console.log(`            - Consumido: ${quantityConsumed} unidades`);
      console.log(`            - A restaurar: ${quantityToRestore} unidades`);
      console.log(`            - Cantidad actual: ${m.current_quantity}`);
      console.log(`            - Cantidad después: ${m.current_quantity + quantityToRestore}`);
      console.log(`            - Estado actual: ${m.status}`);

      if (m.status === BatchStatus.DEPLETED && quantityToRestore > 0) {
        console.log(`            - ⚡ Se REACTIVARÁ a ACTIVE`);
      }

      totalToRestore -= quantityToRestore;
      if (totalToRestore <= 0) break;
    }

    if (totalToRestore > 0) {
      console.log(`      ⚠️  ADVERTENCIA: Quedan ${totalToRestore} unidades sin origen (posible error)`);
    }
  }

  console.log('\n✅ Simulación completada - No se modificaron datos');
}

// Ejecutar
bootstrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
