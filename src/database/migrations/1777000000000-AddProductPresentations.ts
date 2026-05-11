import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 1 — Sistema de Presentaciones de Venta (aditivo, no destructivo).
 *
 * Permite vender un mismo producto en múltiples formatos (cartón, cajetilla,
 * media docena, kilo, gramo, paquete, unidad). Stock siempre en `baseUnit`;
 * cada presentación tiene `factor` (multiplicador a unidad base) y `price`.
 *
 * Esta migración es **completamente compatible hacia atrás**:
 *   - Agrega columnas opcionales a `products` con defaults seguros.
 *   - Crea la tabla `product_presentations` y un backfill: 1 presentación
 *     default por cada producto existente (factor=1, isDefault=true,
 *     precio = primer ProductPrice activo o 0).
 *   - Facturación, FIFO e inventario siguen funcionando exactamente igual:
 *     ningún módulo consume todavía `presentationId`.
 *
 * Idempotente: revisa existencia antes de cada DDL/DML.
 */
export class AddProductPresentations1777000000000 implements MigrationInterface {
  name = 'AddProductPresentations1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Columnas nuevas en products
    const baseUnitExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'baseUnit'
    `);
    if (baseUnitExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "products" ADD COLUMN "baseUnit" varchar(20) NULL`,
      );
      console.log('✅ baseUnit agregada a products');
    }

    const allowsFractionalExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'allowsFractional'
    `);
    if (allowsFractionalExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "products" ADD COLUMN "allowsFractional" boolean NOT NULL DEFAULT false`,
      );
      console.log('✅ allowsFractional agregada a products');
    }

    const isWeighedExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'isWeighed'
    `);
    if (isWeighedExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "products" ADD COLUMN "isWeighed" boolean NOT NULL DEFAULT false`,
      );
      console.log('✅ isWeighed agregada a products');
    }

    // 2. Tabla product_presentations
    const tableExists = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'product_presentations'
    `);
    if (tableExists.length === 0) {
      await queryRunner.query(`
        CREATE TABLE "product_presentations" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deleted_at" timestamptz NULL,
          "name" varchar(50) NOT NULL,
          "factor" decimal(14,4) NOT NULL DEFAULT 1,
          "price" decimal(12,2) NOT NULL DEFAULT 0,
          "currency" varchar(3) NOT NULL DEFAULT 'COP',
          "barcode" varchar(30) NULL,
          "sku" varchar(50) NULL,
          "isDefault" boolean NOT NULL DEFAULT false,
          "isActive" boolean NOT NULL DEFAULT true,
          "sortOrder" integer NOT NULL DEFAULT 0,
          "product_id" uuid NOT NULL,
          CONSTRAINT "PK_product_presentations" PRIMARY KEY ("id"),
          CONSTRAINT "FK_product_presentations_product"
            FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_product_presentations_product_id" ON "product_presentations" ("product_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_product_presentations_barcode" ON "product_presentations" ("barcode")`,
      );
      console.log('✅ Tabla product_presentations creada');
    }

    // 3. Backfill: 1 presentación default por cada producto existente
    // Solo crea si el producto NO tiene presentaciones todavía.
    // Toma el precio del primer ProductPrice activo (PRICE1 público) o 0.
    const result = await queryRunner.query(`
      WITH default_price AS (
        SELECT DISTINCT ON (pp.product_id)
          pp.product_id,
          pp.amount
        FROM "product_prices" pp
        WHERE pp.status = 'active'
          AND pp.deleted_at IS NULL
        ORDER BY pp.product_id,
                 CASE pp.type
                   WHEN 'price1' THEN 1
                   WHEN 'price2' THEN 2
                   WHEN 'price3' THEN 3
                   ELSE 99
                 END,
                 pp.created_at DESC
      )
      INSERT INTO "product_presentations"
        ("name", "factor", "price", "currency", "isDefault", "isActive", "sortOrder", "product_id")
      SELECT
        COALESCE(p."unit", 'Unidad') AS name,
        1                            AS factor,
        COALESCE(dp.amount, 0)       AS price,
        'COP'                        AS currency,
        true                         AS "isDefault",
        true                         AS "isActive",
        0                            AS "sortOrder",
        p.id                         AS product_id
      FROM "products" p
      LEFT JOIN default_price dp ON dp.product_id = p.id
      WHERE p.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "product_presentations" pres
          WHERE pres.product_id = p.id
        )
    `);
    console.log(
      `✅ Backfill: ${result?.[1] ?? 'N/A'} presentaciones default creadas`,
    );

    console.log('✅ Migración AddProductPresentations completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_presentations_barcode"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_presentations_product_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_presentations"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "isWeighed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "allowsFractional"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "baseUnit"`,
    );
    console.log('✅ Rollback AddProductPresentations completado');
  }
}
