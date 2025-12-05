import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Composite Indexes to Products Table
 *
 * Optimización de consultas para el módulo de productos:
 * - Índice compuesto para organización + estado (filtros frecuentes)
 * - Índice compuesto para organización + categoría (navegación por categorías)
 * - Índice único para SKU + organización (validación de unicidad multitenant)
 *
 * Estas optimizaciones reducen significativamente el tiempo de consulta
 * para listados filtrados de productos en organizaciones con muchos productos.
 */
export class AddCompositeIndexesToProducts1763910927000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ⚡ OPTIMIZACIÓN 1: Índice para filtros de organización + estado
    // Mejora queries como: WHERE organization_id = X AND status = 'active'
    await queryRunner.query(`
      CREATE INDEX "idx_product_organization_status"
      ON "products" ("organization_id", "status")
      WHERE "deleted_at" IS NULL;
    `);

    // ⚡ OPTIMIZACIÓN 2: Índice para navegación por organización + categoría
    // Mejora queries como: WHERE organization_id = X AND category_id = Y
    await queryRunner.query(`
      CREATE INDEX "idx_product_organization_category"
      ON "products" ("organization_id", "category_id")
      WHERE "deleted_at" IS NULL;
    `);

    // ⚡ OPTIMIZACIÓN 3: Índice único para SKU por organización (multitenant)
    // Asegura unicidad de SKU dentro de cada organización
    // Mejora validaciones de duplicados en creación/actualización
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_product_sku_organization"
      ON "products" ("sku", "organization_id")
      WHERE "deleted_at" IS NULL;
    `);

    console.log('✅ Composite indexes for products created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Eliminar los índices en orden inverso
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_product_sku_organization";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_product_organization_category";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_product_organization_status";
    `);

    console.log('✅ Composite indexes for products removed successfully');
  }
}
