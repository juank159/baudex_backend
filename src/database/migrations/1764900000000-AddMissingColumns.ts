import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingColumns1764900000000 implements MigrationInterface {
  name = 'AddMissingColumns1764900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add current_balance to bank_accounts
    const hasBankBalanceCol = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'bank_accounts' AND column_name = 'current_balance'
    `);
    if (hasBankBalanceCol.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "bank_accounts"
        ADD COLUMN "current_balance" decimal(12,2) NOT NULL DEFAULT 0
      `);
      console.log('✅ Added current_balance to bank_accounts');
    }

    // 2. Add type enum to expenses
    const hasExpenseTypeCol = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'type'
    `);
    if (hasExpenseTypeCol.length === 0) {
      // Create the enum type first
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expenses_type_enum') THEN
            CREATE TYPE "expenses_type_enum" AS ENUM('operating', 'administrative', 'sales', 'financial', 'extraordinary');
          END IF;
        END$$
      `);
      await queryRunner.query(`
        ALTER TABLE "expenses"
        ADD COLUMN "type" "expenses_type_enum" NOT NULL DEFAULT 'operating'
      `);
      console.log('✅ Added type to expenses');
    }

    // 3. Add tax_percentage to invoice_items
    const hasTaxPercentageCol = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoice_items' AND column_name = 'tax_percentage'
    `);
    if (hasTaxPercentageCol.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "invoice_items"
        ADD COLUMN "tax_percentage" float NOT NULL DEFAULT 19
      `);
      console.log('✅ Added tax_percentage to invoice_items');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP COLUMN IF EXISTS "tax_percentage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "type"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "expenses_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_accounts" DROP COLUMN IF EXISTS "current_balance"`,
    );
  }
}
