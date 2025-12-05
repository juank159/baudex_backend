import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Initial Inventory Batches for Existing Products
 *
 * PROBLEMA DETECTADO:
 * - Productos tienen stock en la columna 'stock' de la tabla products
 * - Pero NO tienen lotes en inventory_batches
 * - El sistema FIFO requiere lotes para poder vender
 * - Esto causa error: "Insufficient stock. Available: 0, Requested: X"
 *
 * SOLUCIÓN:
 * - Crear lotes iniciales para todos los productos que tienen stock > 0
 * - Usar el costo del producto como costo unitario
 * - Marcar estos lotes como "LOTE INICIAL - MIGRACIÓN"
 */
export class CreateInitialInventoryBatches1763913500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔧 === INICIANDO MIGRACIÓN: Crear lotes iniciales de inventario ===',
    );

    // Obtener almacén principal de cada organización (o crear uno si no existe)
    console.log('📦 Paso 1: Verificando almacenes principales...');

    const organizations = await queryRunner.query(`
      SELECT id, name FROM organizations WHERE deleted_at IS NULL;
    `);

    console.log(`✅ Encontradas ${organizations.length} organizaciones activas`);

    for (const org of organizations) {
      // Buscar almacén principal de la organización
      let warehouse = await queryRunner.query(`
        SELECT id FROM warehouses
        WHERE "organizationId" = $1
        AND "isMainWarehouse" = true
        AND deleted_at IS NULL
        LIMIT 1;
      `, [org.id]);

      // Si no existe almacén principal, buscar cualquier almacén
      if (!warehouse || warehouse.length === 0) {
        warehouse = await queryRunner.query(`
          SELECT id FROM warehouses
          WHERE "organizationId" = $1
          AND deleted_at IS NULL
          LIMIT 1;
        `, [org.id]);
      }

      // Si no existe ningún almacén, crear uno
      if (!warehouse || warehouse.length === 0) {
        console.log(`📦 Creando almacén principal para organización ${org.name}...`);

        const newWarehouse = await queryRunner.query(`
          INSERT INTO warehouses (
            id, name, code, description, "isMainWarehouse", "organizationId",
            created_at, updated_at
          )
          VALUES (
            uuid_generate_v4(),
            'Almacén Principal',
            'MAIN',
            'Almacén principal creado por migración',
            true,
            $1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING id;
        `, [org.id]);

        warehouse = newWarehouse;
        console.log(`✅ Almacén principal creado para ${org.name}`);
      }

      const warehouseId = warehouse[0].id;

      // Obtener productos con stock > 0 de esta organización
      console.log(`📊 Paso 2: Buscando productos con stock para ${org.name}...`);

      const products = await queryRunner.query(`
        SELECT
          id,
          name,
          stock,
          cost,
          sku
        FROM products
        WHERE organization_id = $1
        AND stock > 0
        AND deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM inventory_batches
          WHERE "productId" = products.id
          AND deleted_at IS NULL
        );
      `, [org.id]);

      console.log(`✅ Encontrados ${products.length} productos con stock sin lotes para ${org.name}`);

      // Crear lotes iniciales
      let createdBatches = 0;
      for (const product of products) {
        const batchNumber = `INIT-${product.sku || product.id.substring(0, 8)}-${Date.now()}`;
        const stock = parseFloat(product.stock);
        const unitCost = parseFloat(product.cost || '0');
        const totalCost = stock * unitCost;

        await queryRunner.query(`
          INSERT INTO inventory_batches (
            id,
            "batchNumber",
            purchase_date,
            "expirationDate",
            quantity,
            "remainingQuantity",
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
            $2,
            $2,
            0,
            $3,
            $4,
            $4,
            'active',
            'Lote inicial creado por migración desde stock existente',
            $5,
            $6,
            $7,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          );
        `, [
          batchNumber,
          stock,
          unitCost,
          totalCost,
          org.id,
          product.id,
          warehouseId,
        ]);

        createdBatches++;

        if (createdBatches % 10 === 0) {
          console.log(`   📦 ${createdBatches} lotes creados...`);
        }
      }

      console.log(`✅ Total de ${createdBatches} lotes iniciales creados para ${org.name}`);
    }

    console.log('🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏪ Revirtiendo migración: Eliminar lotes iniciales...');

    // Eliminar todos los lotes con notas de migración
    await queryRunner.query(`
      DELETE FROM inventory_batches
      WHERE notes = 'Lote inicial creado por migración desde stock existente';
    `);

    // Eliminar almacenes creados por la migración
    await queryRunner.query(`
      DELETE FROM warehouses
      WHERE description = 'Almacén principal creado por migración';
    `);

    console.log('✅ Migración revertida');
  }
}
