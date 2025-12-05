import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix Missing Columns in inventory_batch_movements Table
 *
 * PROBLEMA DETECTADO:
 * - La tabla inventory_batch_movements está faltando 8 columnas críticas definidas en la entity
 * - Específicamente falta "type" que causa error al crear facturas
 * - También faltan: movementDate, unitCost, totalCost, batchQuantityAfter,
 *   batchValueAfter, notes, organization_id
 *
 * SOLUCIÓN:
 * - Crear tipo ENUM para BatchMovementType
 * - Agregar todas las columnas faltantes de acuerdo a la entity
 * - Poblar organization_id desde los lotes relacionados
 * - Crear índices necesarios para optimizar consultas
 * - Migrar datos existentes con valores por defecto razonables
 */
export class FixInventoryBatchMovementsSchema1763925000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔧 === INICIANDO MIGRACIÓN: Agregar columnas faltantes a inventory_batch_movements ===',
    );

    // ========== PASO 1: CREAR TIPO ENUM ==========
    console.log('📝 Paso 1: Creando tipo ENUM para BatchMovementType...');

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE inventory_batch_movement_type_enum AS ENUM (
          'consume',
          'reserve',
          'release',
          'adjust',
          'incoming',
          'outgoing'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('✅ Tipo ENUM creado correctamente');

    // ========== PASO 2: AGREGAR COLUMNAS FALTANTES ==========
    console.log('📦 Paso 2: Agregando columnas faltantes...');

    // 1. type (CRÍTICO - causa el error actual)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "type" inventory_batch_movement_type_enum;
    `);

    // Asignar valor por defecto 'consume' para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_batch_movements"
      SET "type" = 'consume'
      WHERE "type" IS NULL;
    `);

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "type" SET NOT NULL;
    `);

    // 2. movementDate (fecha del movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "movementDate" timestamp;
    `);

    // Copiar created_at a movementDate para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_batch_movements"
      SET "movementDate" = created_at
      WHERE "movementDate" IS NULL;
    `);

    // Establecer default para futuros registros
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "movementDate" SET DEFAULT CURRENT_TIMESTAMP;
    `);

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "movementDate" SET NOT NULL;
    `);

    // 3. unitCost (costo unitario)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "unitCost" decimal(12,4);
    `);

    // Obtener unitCost del lote relacionado para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_batch_movements" bm
      SET "unitCost" = b."unitCost"
      FROM inventory_batches b
      WHERE bm."batchId" = b.id
      AND bm."unitCost" IS NULL;
    `);

    // Establecer 0 para los que no tengan lote relacionado
    await queryRunner.query(`
      UPDATE "inventory_batch_movements"
      SET "unitCost" = 0
      WHERE "unitCost" IS NULL;
    `);

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "unitCost" SET NOT NULL,
      ALTER COLUMN "unitCost" SET DEFAULT 0;
    `);

    // 4. totalCost (costo total)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "totalCost" decimal(12,2);
    `);

    // Calcular totalCost = quantity * unitCost para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_batch_movements"
      SET "totalCost" = "quantity" * "unitCost"
      WHERE "totalCost" IS NULL;
    `);

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "totalCost" SET NOT NULL,
      ALTER COLUMN "totalCost" SET DEFAULT 0;
    `);

    // 5. batchQuantityAfter (cantidad del lote después del movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "batchQuantityAfter" decimal(10,2);
    `);

    // Obtener cantidad actual del lote para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_batch_movements" bm
      SET "batchQuantityAfter" = b."currentQuantity"
      FROM inventory_batches b
      WHERE bm."batchId" = b.id
      AND bm."batchQuantityAfter" IS NULL;
    `);

    // Establecer 0 para los que no tengan lote relacionado
    await queryRunner.query(`
      UPDATE "inventory_batch_movements"
      SET "batchQuantityAfter" = 0
      WHERE "batchQuantityAfter" IS NULL;
    `);

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "batchQuantityAfter" SET NOT NULL,
      ALTER COLUMN "batchQuantityAfter" SET DEFAULT 0;
    `);

    // 6. batchValueAfter (valor del lote después del movimiento)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "batchValueAfter" decimal(12,2);
    `);

    // Obtener valor restante del lote para registros existentes
    await queryRunner.query(`
      UPDATE "inventory_batch_movements" bm
      SET "batchValueAfter" = b."remainingValue"
      FROM inventory_batches b
      WHERE bm."batchId" = b.id
      AND bm."batchValueAfter" IS NULL;
    `);

    // Establecer 0 para los que no tengan lote relacionado
    await queryRunner.query(`
      UPDATE "inventory_batch_movements"
      SET "batchValueAfter" = 0
      WHERE "batchValueAfter" IS NULL;
    `);

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "batchValueAfter" SET NOT NULL,
      ALTER COLUMN "batchValueAfter" SET DEFAULT 0;
    `);

    // 7. notes (notas opcionales)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "notes" text;
    `);

    // 8. organization_id (CRÍTICO para multitenant)
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD COLUMN IF NOT EXISTS "organization_id" uuid;
    `);

    console.log('📊 Paso 3: Poblando organization_id desde lotes relacionados...');

    // Poblar organization_id desde los lotes relacionados
    await queryRunner.query(`
      UPDATE "inventory_batch_movements" bm
      SET "organization_id" = b.organization_id
      FROM inventory_batches b
      WHERE bm."batchId" = b.id
      AND bm."organization_id" IS NULL;
    `);

    // Verificar que todos tengan organization_id
    const orphanRecords = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM "inventory_batch_movements"
      WHERE "organization_id" IS NULL;
    `);

    if (orphanRecords[0].count > 0) {
      console.warn(
        `⚠️  ADVERTENCIA: ${orphanRecords[0].count} registros sin organization_id. Estos serán eliminados.`,
      );

      // Eliminar registros huérfanos sin organization_id
      await queryRunner.query(`
        DELETE FROM "inventory_batch_movements"
        WHERE "organization_id" IS NULL;
      `);
    }

    // Hacer NOT NULL después de migrar datos
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ALTER COLUMN "organization_id" SET NOT NULL;
    `);

    console.log('✅ Todas las columnas agregadas correctamente');

    // ========== PASO 4: CREAR ÍNDICES ==========
    console.log('🔍 Paso 4: Creando índices...');

    // Índice para organization_id (filtros multitenant)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_batch_movements_organization_id"
      ON "inventory_batch_movements"("organization_id");
    `);

    // Índice para movementDate (consultas por fecha)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_batch_movements_movementDate"
      ON "inventory_batch_movements"("movementDate");
    `);

    // Índice compuesto para batchId + movementDate (trazabilidad FIFO)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_batch_movements_batch_date"
      ON "inventory_batch_movements"("batchId", "movementDate");
    `);

    console.log('✅ Índices creados correctamente');

    // ========== PASO 5: AGREGAR FOREIGN KEY PARA organization_id ==========
    console.log('🔗 Paso 5: Agregando constraint de foreign key...');

    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      ADD CONSTRAINT "FK_inventory_batch_movements_organization"
      FOREIGN KEY ("organization_id")
      REFERENCES "organizations"("id")
      ON DELETE CASCADE;
    `);

    console.log('✅ Foreign key agregada correctamente');

    // ========== VALIDACIÓN FINAL ==========
    console.log('🔍 Validando datos migrados...');

    const stats = await queryRunner.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN "type" IS NULL THEN 1 END) as without_type,
        COUNT(CASE WHEN "organization_id" IS NULL THEN 1 END) as without_org
      FROM "inventory_batch_movements";
    `);

    console.log(`📊 Estadísticas de migración:
      - Total de registros: ${stats[0].total}
      - Sin tipo: ${stats[0].without_type}
      - Sin organización: ${stats[0].without_org}
    `);

    console.log('🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏪ Revirtiendo migración...');

    // Eliminar foreign key
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      DROP CONSTRAINT IF EXISTS "FK_inventory_batch_movements_organization";
    `);

    // Eliminar índices
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_inventory_batch_movements_batch_date";
      DROP INDEX IF EXISTS "IDX_inventory_batch_movements_movementDate";
      DROP INDEX IF EXISTS "IDX_inventory_batch_movements_organization_id";
    `);

    // Eliminar columnas agregadas
    await queryRunner.query(`
      ALTER TABLE "inventory_batch_movements"
      DROP COLUMN IF EXISTS "organization_id",
      DROP COLUMN IF EXISTS "notes",
      DROP COLUMN IF EXISTS "batchValueAfter",
      DROP COLUMN IF EXISTS "batchQuantityAfter",
      DROP COLUMN IF EXISTS "totalCost",
      DROP COLUMN IF EXISTS "unitCost",
      DROP COLUMN IF EXISTS "movementDate",
      DROP COLUMN IF EXISTS "type";
    `);

    // Eliminar tipo ENUM
    await queryRunner.query(`
      DROP TYPE IF EXISTS inventory_batch_movement_type_enum;
    `);

    console.log('✅ Migración revertida');
  }
}
