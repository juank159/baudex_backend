import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddCreatedByIdToPayments1732419600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar la columna createdById
    await queryRunner.addColumn(
      'payments',
      new TableColumn({
        name: 'createdById',
        type: 'uuid',
        isNullable: true, // Temporalmente nullable para no romper registros existentes
      }),
    );

    // Agregar la foreign key
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        name: 'FK_payments_createdBy',
        columnNames: ['createdById'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Opcional: Actualizar registros existentes con un usuario por defecto
    // Si hay pagos sin createdById, puedes asignarles un usuario admin o dejarlos null
    // await queryRunner.query(`
    //   UPDATE payments
    //   SET "createdById" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
    //   WHERE "createdById" IS NULL
    // `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar la foreign key
    await queryRunner.dropForeignKey('payments', 'FK_payments_createdBy');

    // Eliminar la columna
    await queryRunner.dropColumn('payments', 'createdById');
  }
}
