import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auditoría completa de constraints UNIQUE globales en sistema multitenant.
 *
 * Corrige 4 constraints que eran globales y deben ser per-organization:
 * 1. products.sku          - Global UNIQUE aún existe (per-org index ya existía pero no se eliminó el global)
 * 2. warehouses.code       - Global UNIQUE
 * 3. sales.saleNumber      - Global UNIQUE
 * 4. payments.paymentNumber - Global UNIQUE
 *
 * Constraints que se verificaron y están CORRECTOS:
 * - organizations.slug/domain   → Son identificadores de org, deben ser globales
 * - users.email                 → Login usa solo email+password, debe ser global
 * - active_sessions.jti         → JWT IDs son globalmente únicos por diseño
 * - client_balances.customerId  → Customer ya está scoped por org
 * - invoices.number             → Ya corregido en migración 1732420000000
 * - purchase_orders.poNumber    → Ya corregido en migración 1764600000000
 * - inventory_movements.movementNumber → Ya corregido en migración 1764990000000
 * - inventory_batches.batchNumber      → Ya corregido en migración 1764990000000
 * - categories.slug, customers.email/document, suppliers.document → Per-org desde creación
 */
export class FixRemainingGlobalUniqueConstraints1765000000000
  implements MigrationInterface
{
  name = 'FixRemainingGlobalUniqueConstraints1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== 1. PRODUCTS.SKU ==========
    // The per-org index "idx_product_sku_organization" already exists (migration 1763910927000)
    // but the GLOBAL unique constraint was never dropped. Drop it now.
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_products_sku"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_products_sku"`,
    );
    console.log(
      '✅ products.sku: Global UNIQUE dropped (per-org index already exists)',
    );

    // ========== 2. WAREHOUSES.CODE ==========
    // Note: warehouses table uses camelCase "organizationId" column (not snake_case)
    await queryRunner.query(
      `ALTER TABLE "warehouses" DROP CONSTRAINT IF EXISTS "warehouses_code_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_warehouses_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_warehouses_code"`,
    );
    // Fix duplicates before creating unique index
    await queryRunner.query(`
      UPDATE "warehouses" SET "code" = "code" || '-DUP-' || SUBSTR("id"::text, 1, 8)
      WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organizationId", "code" ORDER BY "created_at") as rn
          FROM "warehouses"
        ) sub WHERE rn > 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_warehouses_org_code"
       ON "warehouses" ("organizationId", "code")`,
    );
    console.log('✅ warehouses.code: Now unique per organization');

    // ========== 3. SALES.SALENUMBER ==========
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_saleNumber_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_sales_saleNumber"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sales_saleNumber"`,
    );
    // Fix duplicates before creating unique index
    await queryRunner.query(`
      UPDATE "sales" SET "saleNumber" = "saleNumber" || '-DUP-' || SUBSTR("id"::text, 1, 8)
      WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id", "saleNumber" ORDER BY "created_at") as rn
          FROM "sales"
        ) sub WHERE rn > 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sales_org_saleNumber"
       ON "sales" ("organization_id", "saleNumber")`,
    );
    console.log('✅ sales.saleNumber: Now unique per organization');

    // ========== 4. PAYMENTS.PAYMENTNUMBER ==========
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_paymentNumber_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_payments_paymentNumber"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payments_paymentNumber"`,
    );
    // Fix duplicates before creating unique index
    await queryRunner.query(`
      UPDATE "payments" SET "paymentNumber" = "paymentNumber" || '-DUP-' || SUBSTR("id"::text, 1, 8)
      WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id", "paymentNumber" ORDER BY "created_at") as rn
          FROM "payments"
        ) sub WHERE rn > 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_org_paymentNumber"
       ON "payments" ("organization_id", "paymentNumber")`,
    );
    console.log('✅ payments.paymentNumber: Now unique per organization');

    console.log(
      '🎉 All remaining global UNIQUE constraints have been fixed to per-organization',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert products.sku - re-add global unique
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "products_sku_key" UNIQUE ("sku")`,
    );

    // Revert warehouses.code
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_warehouses_org_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_code_key" UNIQUE ("code")`,
    );

    // Revert sales.saleNumber
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_sales_org_saleNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD CONSTRAINT "sales_saleNumber_key" UNIQUE ("saleNumber")`,
    );

    // Revert payments.paymentNumber
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_payments_org_paymentNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentNumber_key" UNIQUE ("paymentNumber")`,
    );

    console.log(
      '⏪ Reverted: All constraints back to global UNIQUE',
    );
  }
}
