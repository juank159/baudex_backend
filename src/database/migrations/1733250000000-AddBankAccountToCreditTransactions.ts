import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankAccountToCreditTransactions1733250000000 implements MigrationInterface {
  name = 'AddBankAccountToCreditTransactions1733250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna bank_account_id a credit_transactions
    await queryRunner.query(`
      ALTER TABLE "credit_transactions"
      ADD COLUMN IF NOT EXISTS "bank_account_id" uuid NULL
    `);

    // Agregar foreign key
    await queryRunner.query(`
      ALTER TABLE "credit_transactions"
      ADD CONSTRAINT "FK_credit_transactions_bank_account"
      FOREIGN KEY ("bank_account_id")
      REFERENCES "bank_accounts"("id")
      ON DELETE SET NULL
    `);

    // Crear índice para optimizar consultas
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_transactions_bank_account"
      ON "credit_transactions"("bank_account_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índice
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_credit_transactions_bank_account"
    `);

    // Eliminar foreign key
    await queryRunner.query(`
      ALTER TABLE "credit_transactions"
      DROP CONSTRAINT IF EXISTS "FK_credit_transactions_bank_account"
    `);

    // Eliminar columna
    await queryRunner.query(`
      ALTER TABLE "credit_transactions"
      DROP COLUMN IF EXISTS "bank_account_id"
    `);
  }
}
