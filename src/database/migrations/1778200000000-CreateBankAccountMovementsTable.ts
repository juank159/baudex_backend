import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: tabla `bank_account_movements`.
 *
 * Cada cambio en el saldo de una cuenta bancaria genera un movement
 * inmutable que sirve como historial auditable. Permite reconstruir el
 * saldo en cualquier punto del tiempo y soportar reportes contables.
 *
 * Reemplaza el cálculo on-the-fly que antes hacía `getTransactions()`
 * combinando Payment + CreditPayment.
 */
export class CreateBankAccountMovementsTable1778200000000 implements MigrationInterface {
  name = 'CreateBankAccountMovementsTable1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum de tipo de movimiento
    await queryRunner.query(`
      CREATE TYPE "public"."bank_account_movements_type_enum" AS ENUM(
        'initial_balance',
        'deposit',
        'withdrawal',
        'invoice_payment',
        'credit_payment',
        'expense_payment',
        'transfer_out',
        'transfer_in',
        'adjustment',
        'refund'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'bank_account_movements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'bank_account_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enumName: 'bank_account_movements_type_enum',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balance_after',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'movement_date',
            type: 'timestamptz',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'reference_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'reference_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'counterparty_account_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'counterparty_movement_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Foreign key: bank_account_id → bank_accounts.id
    await queryRunner.createForeignKey(
      'bank_account_movements',
      new TableForeignKey({
        name: 'FK_bam_bank_account',
        columnNames: ['bank_account_id'],
        referencedTableName: 'bank_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Foreign key: organization_id → organizations.id
    await queryRunner.createForeignKey(
      'bank_account_movements',
      new TableForeignKey({
        name: 'FK_bam_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Índices para performance de consultas comunes
    await queryRunner.createIndex(
      'bank_account_movements',
      new TableIndex({
        name: 'IDX_bam_organization',
        columnNames: ['organization_id'],
      }),
    );
    await queryRunner.createIndex(
      'bank_account_movements',
      new TableIndex({
        name: 'IDX_bam_account',
        columnNames: ['bank_account_id'],
      }),
    );
    // Para listar movimientos ordenados por fecha por cuenta
    await queryRunner.createIndex(
      'bank_account_movements',
      new TableIndex({
        name: 'IDX_bam_account_date',
        columnNames: ['bank_account_id', 'movement_date'],
      }),
    );
    // Para buscar movimientos por documento referenciado
    await queryRunner.createIndex(
      'bank_account_movements',
      new TableIndex({
        name: 'IDX_bam_reference',
        columnNames: ['reference_type', 'reference_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bank_account_movements', true);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."bank_account_movements_type_enum"`,
    );
  }
}
