import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix Missing Columns in inventory_batches and temporary_products
 *
 * PROBLEMA DETECTADO:
 * - inventory_batches: Falta purchaseDate y otras columnas definidas en la entity
 * - temporary_products: Falta currency y metadata
 *
 * Esta migración sincroniza las tablas con las entities actuales.
 */
export class FixInventoryAndTemporaryProductsColumns1763911717000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔧 === INICIANDO MIGRACIÓN: Agregar columnas faltantes ===',
    );

    // ========== FIX 1: inventory_batches ==========
    console.log('📦 Agregando columnas faltantes a inventory_batches...');

    // Agregar purchase_date (CRÍTICO para FIFO)
    await queryRunner.query(`
      ALTER TABLE "inventory_batches"
      ADD COLUMN IF NOT EXISTS "purchase_date" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);

    // Crear índice para purchase_date (optimización FIFO)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_batches_purchase_date"
      ON "inventory_batches"("purchase_date");
    `);

    // Agregar columnas para PEPS mejorado
    await queryRunner.query(`
      ALTER TABLE "inventory_batches"
      ADD COLUMN IF NOT EXISTS "originalQuantity" decimal(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "currentQuantity" decimal(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "reservedQuantity" decimal(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "totalCost" decimal(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "remainingValue" decimal(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS "supplierLotNumber" varchar(100),
      ADD COLUMN IF NOT EXISTS "metadata" json;
    `);

    // Migrar datos existentes de quantity -> originalQuantity y currentQuantity
    await queryRunner.query(`
      UPDATE "inventory_batches"
      SET
        "originalQuantity" = COALESCE("quantity", 0),
        "currentQuantity" = COALESCE("remainingQuantity", "quantity", 0),
        "reservedQuantity" = 0,
        "totalCost" = COALESCE("quantity" * "unitCost", 0),
        "remainingValue" = COALESCE("remainingQuantity" * "unitCost", "quantity" * "unitCost", 0)
      WHERE "originalQuantity" = 0 OR "currentQuantity" = 0;
    `);

    // Crear índice compuesto para optimizar búsquedas FIFO
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_batches_product_purchase"
      ON "inventory_batches"("productId", "purchase_date");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_batches_org_status"
      ON "inventory_batches"("organization_id", "status");
    `);

    console.log(
      '✅ Columnas agregadas a inventory_batches correctamente',
    );

    // ========== FIX 2: temporary_products ==========
    console.log('📦 Agregando columnas faltantes a temporary_products...');

    // Agregar currency (CRÍTICO para el error actual)
    await queryRunner.query(`
      ALTER TABLE "temporary_products"
      ADD COLUMN IF NOT EXISTS "currency" varchar(10) NOT NULL DEFAULT 'COP';
    `);

    // Agregar metadata si no existe
    await queryRunner.query(`
      ALTER TABLE "temporary_products"
      ADD COLUMN IF NOT EXISTS "metadata" json;
    `);

    // Eliminar columnas que NO están en la entity actual
    await queryRunner.query(`
      ALTER TABLE "temporary_products"
      DROP COLUMN IF EXISTS "quantity",
      DROP COLUMN IF EXISTS "barcode",
      DROP COLUMN IF EXISTS "sku",
      DROP COLUMN IF EXISTS "notes",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "organization_id",
      DROP COLUMN IF EXISTS "createdById";
    `);

    console.log(
      '✅ Columnas agregadas/eliminadas de temporary_products correctamente',
    );

    console.log(
      '🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏪ Revirtiendo migración...');

    // Revertir temporary_products
    await queryRunner.query(`
      ALTER TABLE "temporary_products"
      DROP COLUMN IF EXISTS "currency",
      ADD COLUMN IF NOT EXISTS "quantity" decimal(10,2) DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "barcode" varchar(50),
      ADD COLUMN IF NOT EXISTS "sku" varchar(50),
      ADD COLUMN IF NOT EXISTS "notes" text,
      ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "organization_id" uuid,
      ADD COLUMN IF NOT EXISTS "createdById" uuid;
    `);

    // Revertir inventory_batches
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_inventory_batches_org_status";
      DROP INDEX IF EXISTS "IDX_inventory_batches_product_purchase";
      DROP INDEX IF EXISTS "IDX_inventory_batches_purchase_date";
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_batches"
      DROP COLUMN IF EXISTS "purchase_date",
      DROP COLUMN IF EXISTS "originalQuantity",
      DROP COLUMN IF EXISTS "currentQuantity",
      DROP COLUMN IF EXISTS "reservedQuantity",
      DROP COLUMN IF EXISTS "totalCost",
      DROP COLUMN IF EXISTS "remainingValue",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "supplierLotNumber",
      DROP COLUMN IF EXISTS "metadata";
    `);

    console.log('✅ Migración revertida');
  }
}
