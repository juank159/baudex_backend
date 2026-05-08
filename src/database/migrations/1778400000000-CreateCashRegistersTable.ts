import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

/**
 * Migration: tabla `cash_registers`.
 *
 * Implementa el concepto de caja registradora / turno de caja:
 *   - Apertura con saldo inicial declarado.
 *   - Cierre con conteo físico vs esperado por sistema.
 *   - Snapshot del resumen del turno al cierre (inmutable).
 *
 * Modelo simple: una caja abierta por organización a la vez. Cualquier
 * usuario autorizado puede abrir/cerrar.
 */
export class CreateCashRegistersTable1778400000000
  implements MigrationInterface
{
  name = 'CreateCashRegistersTable1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum status
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_registers_status_enum') THEN
          CREATE TYPE "public"."cash_registers_status_enum" AS ENUM ('open', 'closed');
        END IF;
      END $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'cash_registers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'status',
            type: 'enum',
            enumName: 'cash_registers_status_enum',
            default: "'open'",
          },
          {
            name: 'opening_amount',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'closing_expected_amount',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'closing_actual_amount',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'closing_difference',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'closing_summary',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'opened_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'opened_by_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'closed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'closed_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'opening_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'closing_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // FKs
    await queryRunner.createForeignKey(
      'cash_registers',
      new TableForeignKey({
        name: 'FK_cash_registers_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'cash_registers',
      new TableForeignKey({
        name: 'FK_cash_registers_opened_by',
        columnNames: ['opened_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'cash_registers',
      new TableForeignKey({
        name: 'FK_cash_registers_closed_by',
        columnNames: ['closed_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Índices
    await queryRunner.createIndex(
      'cash_registers',
      new TableIndex({
        name: 'IDX_cash_registers_organization',
        columnNames: ['organization_id'],
      }),
    );
    // Índice compuesto: para encontrar la caja OPEN del tenant rápidamente.
    await queryRunner.createIndex(
      'cash_registers',
      new TableIndex({
        name: 'IDX_cash_registers_org_status',
        columnNames: ['organization_id', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cash_registers', true);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."cash_registers_status_enum"`,
    );
  }
}
