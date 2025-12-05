import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix Missing Columns in user_preferences Table
 *
 * PROBLEMA DETECTADO:
 * - user_preferences: Falta organization_id (CRÍTICO para multitenant)
 * - Faltan todas las preferencias de inventario
 * - Faltan todas las preferencias de interfaz
 * - Faltan todas las preferencias de notificaciones
 *
 * Esta migración sincroniza la tabla con la entity actual.
 */
export class FixUserPreferencesColumns1763912000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔧 === INICIANDO MIGRACIÓN: Agregar columnas faltantes a user_preferences ===',
    );

    // ========== FIX: user_preferences ==========
    console.log('👤 Agregando columnas faltantes a user_preferences...');

    // 1. Agregar organization_id (CRÍTICO para multitenant)
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "organization_id" uuid;
    `);

    // 2. Poblar organization_id desde la tabla users
    // Asumimos que cada usuario tiene una organización principal
    await queryRunner.query(`
      UPDATE "user_preferences" up
      SET "organization_id" = u."organization_id"
      FROM "users" u
      WHERE up."userId" = u."id" AND up."organization_id" IS NULL;
    `);

    // 3. Hacer organization_id NOT NULL después de poblar datos
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ALTER COLUMN "organization_id" SET NOT NULL;
    `);

    // 4. Crear índice para organization_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_preferences_organization_id"
      ON "user_preferences"("organization_id");
    `);

    // 5. Agregar foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD CONSTRAINT "FK_user_preferences_organization"
      FOREIGN KEY ("organization_id")
      REFERENCES "organizations"("id")
      ON DELETE RESTRICT;
    `);

    // 6. Agregar preferencias de inventario
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "autoDeductInventory" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "useFifoCosting" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "validateStockBeforeInvoice" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "allowOverselling" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "showStockWarnings" boolean NOT NULL DEFAULT true;
    `);

    // 7. Agregar preferencias de interfaz
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "showConfirmationDialogs" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "useCompactMode" boolean NOT NULL DEFAULT false;
    `);

    // 8. Agregar preferencias de notificaciones
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "enableExpiryNotifications" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "enableLowStockNotifications" boolean NOT NULL DEFAULT true;
    `);

    // 9. Agregar almacén por defecto
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "defaultWarehouseId" uuid;
    `);

    // 10. Agregar configuraciones adicionales (jsonb para mejor rendimiento que json)
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "additionalSettings" jsonb;
    `);

    console.log(
      '✅ Columnas agregadas a user_preferences correctamente',
    );

    console.log('🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏪ Revirtiendo migración de user_preferences...');

    // Revertir en orden inverso
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP COLUMN IF EXISTS "additionalSettings",
      DROP COLUMN IF EXISTS "defaultWarehouseId",
      DROP COLUMN IF EXISTS "enableLowStockNotifications",
      DROP COLUMN IF EXISTS "enableExpiryNotifications",
      DROP COLUMN IF EXISTS "useCompactMode",
      DROP COLUMN IF EXISTS "showConfirmationDialogs",
      DROP COLUMN IF EXISTS "showStockWarnings",
      DROP COLUMN IF EXISTS "allowOverselling",
      DROP COLUMN IF EXISTS "validateStockBeforeInvoice",
      DROP COLUMN IF EXISTS "useFifoCosting",
      DROP COLUMN IF EXISTS "autoDeductInventory";
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP CONSTRAINT IF EXISTS "FK_user_preferences_organization";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_preferences_organization_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP COLUMN IF EXISTS "organization_id";
    `);

    console.log('✅ Migración de user_preferences revertida');
  }
}
