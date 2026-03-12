// src/database/migrations/1733351000000-AddInvoiceRelationToBalanceTransaction.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceRelationToBalanceTransaction1733351000000 implements MigrationInterface {
  name = 'AddInvoiceRelationToBalanceTransaction1733351000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la tabla existe (puede no existir aún si CreateClientBalanceTables no ha corrido)
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_balance_transactions')
    `);
    if (!tableExists[0].exists) {
      console.log('⏭️ Tabla client_balance_transactions no existe aún, se configurará en CreateClientBalanceTables');
      return;
    }

    // Agregar columna related_invoice_id a client_balance_transactions
    await queryRunner.query(`
      ALTER TABLE "client_balance_transactions"
      ADD COLUMN IF NOT EXISTS "related_invoice_id" uuid NULL
    `);

    // Agregar foreign key a invoices
    await queryRunner.query(`
      ALTER TABLE "client_balance_transactions"
      ADD CONSTRAINT "FK_client_balance_trans_invoice"
      FOREIGN KEY ("related_invoice_id")
      REFERENCES "invoices"("id")
      ON DELETE SET NULL
    `);

    // Crear índice para mejorar consultas
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_balance_trans_invoice"
      ON "client_balance_transactions" ("related_invoice_id")
    `);

    console.log('✅ Columna related_invoice_id agregada a client_balance_transactions');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índice
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_client_balance_trans_invoice"
    `);

    // Eliminar foreign key
    await queryRunner.query(`
      ALTER TABLE "client_balance_transactions"
      DROP CONSTRAINT IF EXISTS "FK_client_balance_trans_invoice"
    `);

    // Eliminar columna
    await queryRunner.query(`
      ALTER TABLE "client_balance_transactions"
      DROP COLUMN IF EXISTS "related_invoice_id"
    `);

    console.log('⚠️ Columna related_invoice_id eliminada de client_balance_transactions');
  }
}
