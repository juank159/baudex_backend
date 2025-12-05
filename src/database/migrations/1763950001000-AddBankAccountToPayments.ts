import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankAccountToPayments1763950001000 implements MigrationInterface {
  name = 'AddBankAccountToPayments1763950001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna ya existe
    const columnExists = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'bank_account_id'
    `);

    if (columnExists.length === 0) {
      // Agregar columna bank_account_id a payments
      await queryRunner.query(`
        ALTER TABLE "payments"
        ADD COLUMN "bank_account_id" uuid NULL
      `);

      // Agregar foreign key a bank_accounts
      await queryRunner.query(`
        ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_bank_account"
        FOREIGN KEY ("bank_account_id")
        REFERENCES "bank_accounts"("id")
        ON DELETE SET NULL
      `);

      // Crear índice para bank_account_id
      await queryRunner.query(`
        CREATE INDEX "IDX_payments_bank_account_id"
        ON "payments" ("bank_account_id")
      `);
    }

    // Verificar si el índice compuesto ya existe
    const indexExists = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'payments' AND indexname = 'IDX_payments_invoice_org'
    `);

    if (indexExists.length === 0) {
      // Crear índice compuesto para invoice + organization (usando nombre corto)
      await queryRunner.query(`
        CREATE INDEX "IDX_payments_invoice_org"
        ON "payments" ("invoiceId", "organization_id")
      `);
    }

    console.log('✅ Migración AddBankAccountToPayments completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índices
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payments_invoice_org"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payments_bank_account_id"
    `);

    // Eliminar foreign key
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP CONSTRAINT IF EXISTS "FK_payments_bank_account"
    `);

    // Eliminar columna
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "bank_account_id"
    `);

    console.log('✅ Rollback AddBankAccountToPayments completado');
  }
}
