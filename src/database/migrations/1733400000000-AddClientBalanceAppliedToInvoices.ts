import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientBalanceAppliedToInvoices1733400000000
  implements MigrationInterface
{
  name = 'AddClientBalanceAppliedToInvoices1733400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna client_balance_applied a la tabla invoices
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "client_balance_applied" float NOT NULL DEFAULT 0
    `);

    // Agregar comentario descriptivo
    await queryRunner.query(`
      COMMENT ON COLUMN "invoices"."client_balance_applied" IS 'Saldo a favor del cliente aplicado a esta factura'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP COLUMN IF EXISTS "client_balance_applied"
    `);
  }
}
