import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTaxFieldsToProducts1731876000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar campos para facturación electrónica a la tabla products
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'tax_category',
        type: 'enum',
        enum: ['IVA', 'INC', 'INC_BOLSA', 'EXENTO', 'NO_GRAVADO'],
        default: "'IVA'",
        comment: 'Categoría de impuesto para facturación electrónica',
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'tax_rate',
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 19,
        comment: 'Tasa de impuesto en porcentaje',
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'is_taxable',
        type: 'boolean',
        default: true,
        comment: 'Indica si el producto está gravado con impuestos',
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'tax_description',
        type: 'varchar',
        length: '200',
        isNullable: true,
        comment: 'Descripción del impuesto para la factura',
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'retention_category',
        type: 'enum',
        enum: ['RET_IVA', 'RET_RENTA', 'RET_ICA', 'RET_CREE'],
        isNullable: true,
        comment: 'Categoría de retención en la fuente',
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'retention_rate',
        type: 'decimal',
        precision: 5,
        scale: 2,
        isNullable: true,
        default: 0,
        comment: 'Tasa de retención en porcentaje',
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'has_retention',
        type: 'boolean',
        default: false,
        comment: 'Indica si el producto aplica retención en la fuente',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar los campos en orden inverso
    await queryRunner.dropColumn('products', 'has_retention');
    await queryRunner.dropColumn('products', 'retention_rate');
    await queryRunner.dropColumn('products', 'retention_category');
    await queryRunner.dropColumn('products', 'tax_description');
    await queryRunner.dropColumn('products', 'is_taxable');
    await queryRunner.dropColumn('products', 'tax_rate');
    await queryRunner.dropColumn('products', 'tax_category');
  }
}
