import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPurchaseOrderNumberUniquePerOrg1764600000000
  implements MigrationInterface
{
  name = 'FixPurchaseOrderNumberUniquePerOrg1764600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the GLOBAL unique constraint on poNumber
    //    (it prevents different orgs from having the same PO number)
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_poNumber_key"`,
    );

    // Also drop any auto-generated unique index TypeORM might have created
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_purchase_orders_poNumber"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchase_orders_poNumber"`,
    );

    // 2. Create composite unique index: poNumber unique PER organization
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_purchase_orders_org_poNumber"
       ON "purchase_orders" ("organization_id", "poNumber")`,
    );

    console.log(
      '✅ Migration: poNumber is now unique per organization (not globally)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: drop composite unique, restore global unique
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_purchase_orders_org_poNumber"`,
    );

    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_poNumber_key" UNIQUE ("poNumber")`,
    );

    console.log('⏪ Migration reverted: poNumber is globally unique again');
  }
}
