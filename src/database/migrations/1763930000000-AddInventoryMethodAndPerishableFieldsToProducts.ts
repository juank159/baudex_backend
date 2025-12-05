import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Inventory Method and Perishable Fields to Products
 *
 * OBJETIVO:
 * Agregar campos profesionales para soporte de FIFO, FEFO y productos perecederos
 * según estándares de la industria 2024-2025
 *
 * CAMPOS AGREGADOS:
 * - inventoryMethod: Método de valoración (FIFO, FEFO, AVERAGE)
 * - isPerishable: Indica si el producto es perecedero
 * - hasExpirationTracking: Indica si se rastrea fecha de vencimiento
 * - shelfLifeDays: Días de vida útil del producto
 * - alertDaysBeforeExpiry: Días antes de vencimiento para alertar
 *
 * ESTÁNDARES:
 * - FIFO (First-In, First-Out): Método estándar
 * - FEFO (First-Expired, First-Out): Para productos perecederos
 * - Compatible con IFRS (No incluye LIFO prohibido por IFRS)
 */
export class AddInventoryMethodAndPerishableFieldsToProducts1763930000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔧 === INICIANDO MIGRACIÓN: Agregar campos de método de inventario ===',
    );

    // ========== PASO 1: CREAR ENUM PARA MÉTODO DE INVENTARIO ==========
    console.log('📝 Paso 1: Creando tipo ENUM para inventoryMethod...');

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE product_inventory_method_enum AS ENUM (
          'FIFO',
          'FEFO',
          'AVERAGE'
        );
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'ENUM product_inventory_method_enum ya existe, continuando...';
      END $$;
    `);

    console.log('✅ Tipo ENUM creado correctamente');

    // ========== PASO 2: AGREGAR COLUMNAS ==========
    console.log('📦 Paso 2: Agregando nuevas columnas...');

    // 1. inventoryMethod - Método de valoración de inventario
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "inventoryMethod" product_inventory_method_enum NOT NULL DEFAULT 'FIFO';
    `);

    console.log('   ✅ inventoryMethod agregado (default: FIFO)');

    // 2. isPerishable - Indica si el producto es perecedero
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "isPerishable" boolean NOT NULL DEFAULT false;
    `);

    console.log('   ✅ isPerishable agregado');

    // 3. hasExpirationTracking - Indica si se rastrea vencimiento
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "hasExpirationTracking" boolean NOT NULL DEFAULT false;
    `);

    console.log('   ✅ hasExpirationTracking agregado');

    // 4. shelfLifeDays - Vida útil en días
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "shelfLifeDays" integer NULL;
    `);

    console.log('   ✅ shelfLifeDays agregado');

    // 5. alertDaysBeforeExpiry - Días antes de vencimiento para alertar
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "alertDaysBeforeExpiry" integer NOT NULL DEFAULT 7;
    `);

    console.log('   ✅ alertDaysBeforeExpiry agregado (default: 7 días)');

    // ========== PASO 3: MIGRACIÓN DE DATOS INTELIGENTE ==========
    console.log('📊 Paso 3: Configurando productos existentes...');

    // Configurar automáticamente productos con fechas de vencimiento en lotes
    await queryRunner.query(`
      UPDATE "products" p
      SET
        "isPerishable" = true,
        "hasExpirationTracking" = true,
        "inventoryMethod" = 'FEFO'
      WHERE EXISTS (
        SELECT 1
        FROM inventory_batches ib
        WHERE ib."productId" = p.id
        AND ib."expirationDate" IS NOT NULL
        AND ib.deleted_at IS NULL
      );
    `);

    const updatedProducts = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM "products"
      WHERE "inventoryMethod" = 'FEFO';
    `);

    console.log(
      `   ✅ ${updatedProducts[0].count} productos configurados como FEFO automáticamente`,
    );

    // ========== PASO 4: CREAR ÍNDICES PARA OPTIMIZACIÓN ==========
    console.log('🔍 Paso 4: Creando índices de optimización...');

    // Índice para filtrar por método de inventario
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_inventory_method"
      ON "products"("inventoryMethod")
      WHERE deleted_at IS NULL;
    `);

    // Índice para productos perecederos
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_perishable"
      ON "products"("isPerishable", "hasExpirationTracking")
      WHERE deleted_at IS NULL AND "isPerishable" = true;
    `);

    console.log('✅ Índices creados correctamente');

    // ========== PASO 5: COMENTARIOS EN LA BASE DE DATOS ==========
    console.log('📝 Paso 5: Agregando comentarios de documentación...');

    await queryRunner.query(`
      COMMENT ON COLUMN "products"."inventoryMethod" IS
      'Método de valoración de inventario: FIFO (First-In First-Out), FEFO (First-Expired First-Out), AVERAGE (Promedio Ponderado)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "products"."isPerishable" IS
      'Indica si el producto es perecedero y requiere control especial de vencimiento';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "products"."hasExpirationTracking" IS
      'Indica si se debe rastrear y alertar sobre fechas de vencimiento de lotes';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "products"."shelfLifeDays" IS
      'Vida útil del producto en días desde la fecha de producción/compra';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "products"."alertDaysBeforeExpiry" IS
      'Días antes del vencimiento para generar alertas (default: 7)';
    `);

    console.log('✅ Comentarios agregados');

    // ========== VALIDACIÓN FINAL ==========
    console.log('🔍 Validando migración...');

    const stats = await queryRunner.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN "inventoryMethod" = 'FIFO' THEN 1 END) as fifo_count,
        COUNT(CASE WHEN "inventoryMethod" = 'FEFO' THEN 1 END) as fefo_count,
        COUNT(CASE WHEN "inventoryMethod" = 'AVERAGE' THEN 1 END) as average_count,
        COUNT(CASE WHEN "isPerishable" = true THEN 1 END) as perishable_count,
        COUNT(CASE WHEN "hasExpirationTracking" = true THEN 1 END) as tracking_count
      FROM "products"
      WHERE deleted_at IS NULL;
    `);

    console.log(`📊 Estadísticas de migración:
      - Total de productos: ${stats[0].total}
      - FIFO: ${stats[0].fifo_count}
      - FEFO: ${stats[0].fefo_count}
      - AVERAGE: ${stats[0].average_count}
      - Perecederos: ${stats[0].perishable_count}
      - Con tracking: ${stats[0].tracking_count}
    `);

    console.log('🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏪ Revirtiendo migración...');

    // Eliminar comentarios
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."inventoryMethod" IS NULL;
      COMMENT ON COLUMN "products"."isPerishable" IS NULL;
      COMMENT ON COLUMN "products"."hasExpirationTracking" IS NULL;
      COMMENT ON COLUMN "products"."shelfLifeDays" IS NULL;
      COMMENT ON COLUMN "products"."alertDaysBeforeExpiry" IS NULL;
    `);

    // Eliminar índices
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_products_perishable";
      DROP INDEX IF EXISTS "IDX_products_inventory_method";
    `);

    // Eliminar columnas
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN IF EXISTS "alertDaysBeforeExpiry",
      DROP COLUMN IF EXISTS "shelfLifeDays",
      DROP COLUMN IF EXISTS "hasExpirationTracking",
      DROP COLUMN IF EXISTS "isPerishable",
      DROP COLUMN IF EXISTS "inventoryMethod";
    `);

    // Eliminar tipo ENUM
    await queryRunner.query(`
      DROP TYPE IF EXISTS product_inventory_method_enum;
    `);

    console.log('✅ Migración revertida');
  }
}
