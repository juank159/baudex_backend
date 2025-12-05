import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceCreditedStatusAndAmount1763945000000
  implements MigrationInterface
{
  name = 'AddInvoiceCreditedStatusAndAmount1763945000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar la columna creditedAmount a invoices
    // El campo status ya es VARCHAR así que los nuevos valores (credited, partially_credited)
    // se pueden usar directamente sin modificar el schema
    const checkColumn = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'credited_amount'
      ) as exists
    `);

    if (!checkColumn[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "invoices" ADD COLUMN "credited_amount" double precision DEFAULT 0 NOT NULL
      `);
      console.log('✅ Added creditedAmount column to invoices table');
    } else {
      console.log('ℹ️ Column creditedAmount already exists in invoices table');
    }

    console.log('✅ Migration completed: Invoice can now track credited amounts');
    console.log('ℹ️ New invoice statuses available: credited, partially_credited');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar la columna creditedAmount
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP COLUMN IF EXISTS "credited_amount"
    `);

    // Revertir facturas con estados de crédito a pending
    await queryRunner.query(`
      UPDATE "invoices" SET "status" = 'pending'
      WHERE "status" IN ('credited', 'partially_credited')
    `);

    console.log('⬇️ Migration reverted: Removed creditedAmount column from invoices');
  }
}
