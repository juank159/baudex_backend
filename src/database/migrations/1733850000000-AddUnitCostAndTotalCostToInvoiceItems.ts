import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUnitCostAndTotalCostToInvoiceItems1733850000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('➕ Agregando columnas unit_cost y total_cost a invoice_items...');

    // Agregar columna unit_cost
    await queryRunner.addColumn(
      'invoice_items',
      new TableColumn({
        name: 'unit_cost',
        type: 'decimal',
        precision: 12,
        scale: 4,
        default: 0.0000,
        isNullable: true,
        comment: 'Costo unitario del producto para cálculo FIFO',
      }),
    );
    console.log('✅ Columna unit_cost agregada');

    // Agregar columna total_cost
    await queryRunner.addColumn(
      'invoice_items',
      new TableColumn({
        name: 'total_cost',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0.00,
        isNullable: true,
        comment: 'Costo total del item (unit_cost * quantity)',
      }),
    );
    console.log('✅ Columna total_cost agregada');

    console.log('✅ Migración completada: Columnas de costo agregadas a invoice_items');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⬇️ Revirtiendo columnas unit_cost y total_cost de invoice_items...');

    await queryRunner.dropColumn('invoice_items', 'total_cost');
    console.log('✅ Columna total_cost eliminada');

    await queryRunner.dropColumn('invoice_items', 'unit_cost');
    console.log('✅ Columna unit_cost eliminada');

    console.log('✅ Reversión completada');
  }
}
