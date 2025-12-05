import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix Missing Columns in inventory_movements Table
 *
 * PROBLEMA DETECTADO:
 * - La tabla inventory_movements está faltando columnas críticas definidas en la entity
 * - Específicamente falta "movementNumber" que causa error al crear facturas
 * - También faltan: status, movementDate, unitPrice, totalPrice, stockAfter, stockValueAfter,
 *   referenceType, referenceNumber, referenceId
 *
 * SOLUCIÓN:
 * - Agregar todas las columnas faltantes de acuerdo a la entity
 * - Crear índices necesarios para optimizar consultas
 * - Migrar datos existentes a las nuevas columnas con valores por defecto razonables
 */
export class FixInventoryMovementsColumns1763920000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔧 === INICIANDO MIGRACIÓN: Agregar columnas faltantes a inventory_movements ===',
    );

    // ========== AGREGAR COLUMNAS FALTANTES ==========

    // 1. movementNumber (CRÍTICO para generar números de movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "movementNumber" varchar(50) UNIQUE;
    `);

    // Generar movementNumber para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_movements"
      SET "movementNumber" = 'MOV-' || TO_CHAR(created_at, 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0')
      WHERE "movementNumber" IS NULL;
    `);

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ALTER COLUMN "movementNumber" SET NOT NULL;
    `);

    // 2. status (estado del movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'confirmed';
    `);

    // 3. movementDate (fecha del movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "movementDate" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);

    // Copiar created_at a movementDate para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_movements"
      SET "movementDate" = created_at
      WHERE "movementDate" = CURRENT_TIMESTAMP;
    `);

    // 4. unitPrice (precio unitario de venta)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "unitPrice" decimal(12,2);
    `);

    // 5. totalPrice (precio total de venta)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "totalPrice" decimal(12,2);
    `);

    // 6. stockAfter (stock después del movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "stockAfter" decimal(10,2) NOT NULL DEFAULT 0;
    `);

    // 7. stockValueAfter (valor del stock después del movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "stockValueAfter" decimal(12,2) NOT NULL DEFAULT 0;
    `);

    // 8. referenceType (tipo de referencia)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "referenceType" varchar(100);
    `);

    // 9. referenceNumber (número de referencia)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "referenceNumber" varchar(100);
    `);

    // 10. referenceId (ID de referencia)
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "referenceId" uuid;
    `);

    // ========== ACTUALIZAR COLUMNAS EXISTENTES ==========

    // Actualizar unitCost para que tenga valores por defecto
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ALTER COLUMN "unitCost" SET DEFAULT 0;
    `);

    // Actualizar totalCost para que tenga valores por defecto
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ALTER COLUMN "totalCost" SET DEFAULT 0;
    `);

    // ========== CREAR ÍNDICES ==========

    // Índice para movementDate (optimiza consultas por fecha)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_movementDate"
      ON "inventory_movements"("movementDate");
    `);

    // Índice compuesto para productId + movementDate (FIFO)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_product_date"
      ON "inventory_movements"("productId", "movementDate");
    `);

    // Índice compuesto para organizationId + movementDate (reportes)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_org_date"
      ON "inventory_movements"("organization_id", "movementDate");
    `);

    console.log('✅ Columnas agregadas a inventory_movements correctamente');
    console.log('🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏪ Revirtiendo migración...');

    // Eliminar índices
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_inventory_movements_org_date";
      DROP INDEX IF EXISTS "IDX_inventory_movements_product_date";
      DROP INDEX IF EXISTS "IDX_inventory_movements_movementDate";
    `);

    // Eliminar columnas agregadas
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      DROP COLUMN IF EXISTS "referenceId",
      DROP COLUMN IF EXISTS "referenceNumber",
      DROP COLUMN IF EXISTS "referenceType",
      DROP COLUMN IF EXISTS "stockValueAfter",
      DROP COLUMN IF EXISTS "stockAfter",
      DROP COLUMN IF EXISTS "totalPrice",
      DROP COLUMN IF EXISTS "unitPrice",
      DROP COLUMN IF EXISTS "movementDate",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "movementNumber";
    `);

    console.log('✅ Migración revertida');
  }
}
