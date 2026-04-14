import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixMovementNumberUniquePerOrg1764990000000
  implements MigrationInterface
{
  name = 'FixMovementNumberUniquePerOrg1764990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== INVENTORY MOVEMENTS ==========
    // 1. Drop the GLOBAL unique constraint on movementNumber
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_movementNumber_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_inventory_movements_movementNumber"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_movements_movementNumber"`,
    );

    // 1b. Fix duplicate movementNumbers within same org before creating unique index
    await queryRunner.query(`
      UPDATE "inventory_movements" SET "movementNumber" = "movementNumber" || '-DUP-' || "id"::text
      WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id", "movementNumber" ORDER BY "created_at") as rn
          FROM "inventory_movements"
        ) sub WHERE rn > 1
      )
    `);

    // 2. Create composite unique index: movementNumber unique PER organization
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_inventory_movements_org_movementNumber"
       ON "inventory_movements" ("organization_id", "movementNumber")`,
    );

    console.log(
      '✅ movementNumber is now unique per organization (not globally)',
    );

    // ========== INVENTORY BATCHES ==========
    // 3. Drop the GLOBAL unique constraint on batchNumber
    await queryRunner.query(
      `ALTER TABLE "inventory_batches" DROP CONSTRAINT IF EXISTS "inventory_batches_batchNumber_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_inventory_batches_batchNumber"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_batches_batchNumber"`,
    );

    // 3b. Fix duplicate batchNumbers within same org before creating unique index
    await queryRunner.query(`
      UPDATE "inventory_batches" SET "batchNumber" = "batchNumber" || '-DUP-' || "id"::text
      WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id", "batchNumber" ORDER BY "created_at") as rn
          FROM "inventory_batches"
        ) sub WHERE rn > 1
      )
    `);

    // 4. Create composite unique index: batchNumber unique PER organization
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_inventory_batches_org_batchNumber"
       ON "inventory_batches" ("organization_id", "batchNumber")`,
    );

    console.log(
      '✅ batchNumber is now unique per organization (not globally)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert movements
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_inventory_movements_org_movementNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_movementNumber_key" UNIQUE ("movementNumber")`,
    );

    // Revert batches
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_inventory_batches_org_batchNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_batchNumber_key" UNIQUE ("batchNumber")`,
    );

    console.log(
      '⏪ Reverted: movementNumber and batchNumber are globally unique again',
    );
  }
}
