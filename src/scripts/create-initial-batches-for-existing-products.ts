import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

/**
 * Script Profesional: Crear Lotes Iniciales para Productos Existentes
 *
 * PROPÓSITO:
 * Migrar productos que fueron creados manualmente con stock > 0
 * pero SIN lotes en inventory_batches, causando error FIFO
 *
 * PROCESO:
 * 1. Buscar productos con stock > 0 sin lotes
 * 2. Crear lote inicial por cada producto
 * 3. Crear movimiento de inventario INITIAL_STOCK
 * 4. Crear relación batch-movement
 *
 * USO:
 * npm run console -- ts-node src/scripts/create-initial-batches-for-existing-products.ts
 */

async function bootstrap() {
  console.log('🚀 ===== INICIANDO SCRIPT DE MIGRACIÓN DE LOTES =====\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    console.log('📊 Paso 1: Buscando productos sin lotes...\n');

    // Buscar productos con stock pero sin lotes
    const productsWithoutBatches = await queryRunner.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.stock,
        p.cost,
        p.organization_id as "organizationId",
        p.created_by_id as "createdById",
        o.name as "organizationName"
      FROM products p
      INNER JOIN organizations o ON p.organization_id = o.id
      WHERE p.stock > 0
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM inventory_batches ib
        WHERE ib."productId" = p.id
        AND ib.deleted_at IS NULL
      )
      ORDER BY p.organization_id, p.name;
    `);

    console.log(
      `✅ Encontrados ${productsWithoutBatches.length} productos con stock sin lotes\n`,
    );

    if (productsWithoutBatches.length === 0) {
      console.log('✨ No hay productos para migrar. Todo está correcto!\n');
      await app.close();
      return;
    }

    // Mostrar resumen
    console.log('📋 RESUMEN DE PRODUCTOS A MIGRAR:\n');
    const byOrganization = productsWithoutBatches.reduce((acc, p) => {
      const orgName = p.organizationName;
      if (!acc[orgName]) {
        acc[orgName] = [];
      }
      acc[orgName].push(p);
      return {};
    }, {});

    for (const [orgName, products] of Object.entries(byOrganization)) {
      console.log(`  📁 ${orgName}: ${(products as any[]).length} productos`);
    }

    console.log('\n⚠️  ATENCIÓN: Se crearán lotes y movimientos para estos productos\n');
    console.log('⏳ Iniciando migración en 3 segundos...\n');

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await queryRunner.startTransaction();

    let createdBatches = 0;
    let createdMovements = 0;
    let errors = 0;

    console.log('🔄 Paso 2: Creando lotes iniciales...\n');

    for (const product of productsWithoutBatches) {
      try {
        const stock = parseFloat(product.stock);
        const unitCost = parseFloat(product.cost || '0');
        const totalCost = stock * unitCost;

        console.log(`   📦 Procesando: ${product.name} (${product.sku})`);
        console.log(`      - Stock: ${stock} unidades`);
        console.log(`      - Costo unitario: $${unitCost.toLocaleString()}`);

        // 1. Obtener o crear almacén principal
        const warehouses = await queryRunner.query(
          `
          SELECT id FROM warehouses
          WHERE "organizationId" = $1
          AND "isMainWarehouse" = true
          AND deleted_at IS NULL
          LIMIT 1;
        `,
          [product.organizationId],
        );

        let warehouseId = warehouses[0]?.id;

        if (!warehouseId) {
          // Crear almacén principal
          const newWarehouse = await queryRunner.query(
            `
            INSERT INTO warehouses (
              id, name, code, description, "isMainWarehouse", "organizationId",
              "isActive", created_at, updated_at
            )
            VALUES (
              uuid_generate_v4(),
              'Almacén Principal',
              'MAIN',
              'Almacén principal creado por migración',
              true,
              $1,
              true,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            RETURNING id;
          `,
            [product.organizationId],
          );

          warehouseId = newWarehouse[0].id;
          console.log(`      ✅ Almacén principal creado`);
        }

        // 2. Generar número de lote único
        const batchNumber = `INIT-${product.sku}-${Date.now()}`;

        // 3. Crear lote inicial
        const batch = await queryRunner.query(
          `
          INSERT INTO inventory_batches (
            id,
            "batchNumber",
            purchase_date,
            "expirationDate",
            "originalQuantity",
            "currentQuantity",
            "reservedQuantity",
            "unitCost",
            "totalCost",
            "remainingValue",
            status,
            notes,
            organization_id,
            "productId",
            "warehouseId",
            created_at,
            updated_at
          )
          VALUES (
            uuid_generate_v4(),
            $1,
            CURRENT_TIMESTAMP,
            NULL,
            $2,
            $2,
            0,
            $3,
            $4,
            $4,
            'active',
            'Lote inicial creado por script de migración',
            $5,
            $6,
            $7,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING id, "batchNumber";
        `,
          [
            batchNumber,
            stock,
            unitCost,
            totalCost,
            product.organizationId,
            product.id,
            warehouseId,
          ],
        );

        createdBatches++;
        console.log(`      ✅ Lote creado: ${batch[0].batchNumber}`);

        // 4. Generar número de movimiento único
        const movementNumber = `MOV-INIT-${product.sku}-${Date.now()}`;

        // 5. Crear movimiento de inventario
        const movement = await queryRunner.query(
          `
          INSERT INTO inventory_movements (
            id,
            "movementNumber",
            type,
            status,
            "productId",
            organization_id,
            "performedById",
            "movementDate",
            quantity,
            "unitCost",
            "totalCost",
            "stockAfter",
            "stockValueAfter",
            "referenceType",
            notes,
            "warehouseId",
            created_at,
            updated_at
          )
          VALUES (
            uuid_generate_v4(),
            $1,
            'initial_stock',
            'confirmed',
            $2,
            $3,
            $4,
            CURRENT_TIMESTAMP,
            $5,
            $6,
            $7,
            $5,
            $7,
            'migration_script',
            'Stock inicial creado por script de migración',
            $8,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING id, "movementNumber";
        `,
          [
            movementNumber,
            product.id,
            product.organizationId,
            product.createdById,
            stock,
            unitCost,
            totalCost,
            warehouseId,
          ],
        );

        createdMovements++;
        console.log(`      ✅ Movimiento creado: ${movement[0].movementNumber}`);

        // 6. Crear relación batch-movement
        await queryRunner.query(
          `
          INSERT INTO inventory_batch_movements (
            id,
            type,
            "movementDate",
            "batchId",
            "movementId",
            organization_id,
            quantity,
            "unitCost",
            "totalCost",
            "batchQuantityAfter",
            "batchValueAfter",
            created_at,
            updated_at
          )
          VALUES (
            uuid_generate_v4(),
            'incoming',
            CURRENT_TIMESTAMP,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $4,
            $6,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          );
        `,
          [
            batch[0].id,
            movement[0].id,
            product.organizationId,
            stock,
            unitCost,
            totalCost,
          ],
        );

        console.log(`      ✅ Relación batch-movement creada\n`);
      } catch (error) {
        console.error(
          `      ❌ Error procesando producto ${product.name}:`,
          error.message,
        );
        errors++;
      }
    }

    await queryRunner.commitTransaction();

    console.log('\n🎉 ===== MIGRACIÓN COMPLETADA =====\n');
    console.log(`✅ Lotes creados: ${createdBatches}`);
    console.log(`✅ Movimientos creados: ${createdMovements}`);
    if (errors > 0) {
      console.log(`⚠️  Errores: ${errors}`);
    }
    console.log('\n');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:\n', error);
    throw error;
  } finally {
    await queryRunner.release();
    await app.close();
  }
}

bootstrap()
  .then(() => {
    console.log('✨ Script finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script falló:', error);
    process.exit(1);
  });
