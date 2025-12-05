import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddIndexesToInvoices1732420100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear índices para mejorar el rendimiento de consultas
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_invoices_date',
        columnNames: ['date'],
      }),
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_invoices_dueDate',
        columnNames: ['dueDate'],
      }),
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_invoices_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_invoices_customerId',
        columnNames: ['customerId'],
      }),
    );

    // Índices compuestos para consultas multitenant frecuentes
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_invoices_organizationId_date',
        columnNames: ['organization_id', 'date'],
      }),
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_invoices_organizationId_status',
        columnNames: ['organization_id', 'status'],
      }),
    );

    console.log('✅ Índices creados para mejorar rendimiento de consultas en invoices');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('invoices', 'IDX_invoices_organizationId_status');
    await queryRunner.dropIndex('invoices', 'IDX_invoices_organizationId_date');
    await queryRunner.dropIndex('invoices', 'IDX_invoices_customerId');
    await queryRunner.dropIndex('invoices', 'IDX_invoices_status');
    await queryRunner.dropIndex('invoices', 'IDX_invoices_dueDate');
    await queryRunner.dropIndex('invoices', 'IDX_invoices_date');

    console.log('⬇️ Índices eliminados de invoices');
  }
}
