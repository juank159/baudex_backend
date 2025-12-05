import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class FixInvoiceNumberUniqueIndex1732420000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar el índice único simple existente en 'number'
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "UQ_invoices_number";
    `);

    // También eliminar el índice si existe con otro nombre
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_number";
    `);

    // 2. Crear índice único compuesto en (organization_id, number)
    // Esto permite que diferentes organizaciones usen el mismo número de factura
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_invoices_organization_number_unique',
        columnNames: ['organization_id', 'number'],
        isUnique: true,
      }),
    );

    console.log('✅ Índice único compuesto creado: (organization_id, number)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: eliminar índice compuesto
    await queryRunner.dropIndex('invoices', 'IDX_invoices_organization_number_unique');

    // Restaurar índice único simple en 'number'
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD CONSTRAINT "UQ_invoices_number" UNIQUE ("number");
    `);

    console.log('⬇️ Revertido a índice único simple en number');
  }
}
