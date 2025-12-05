import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateBankAccountsTable1763950000000 implements MigrationInterface {
  name = 'CreateBankAccountsTable1763950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear el tipo enum para bank_accounts_type
    await queryRunner.query(`
      CREATE TYPE "public"."bank_accounts_type_enum" AS ENUM(
        'cash',
        'savings',
        'checking',
        'digital_wallet',
        'credit_card',
        'debit_card',
        'other'
      )
    `);

    // Crear la tabla bank_accounts
    await queryRunner.createTable(
      new Table({
        name: 'bank_accounts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['cash', 'savings', 'checking', 'digital_wallet', 'credit_card', 'debit_card', 'other'],
            enumName: 'bank_accounts_type_enum',
            default: "'cash'",
          },
          {
            name: 'bank_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'account_number',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'holder_name',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'icon',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'description',
            type: 'text',
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
            name: 'updated_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Crear índices
    await queryRunner.createIndex(
      'bank_accounts',
      new TableIndex({
        name: 'IDX_bank_accounts_organization',
        columnNames: ['organization_id'],
      }),
    );

    await queryRunner.createIndex(
      'bank_accounts',
      new TableIndex({
        name: 'IDX_bank_accounts_active',
        columnNames: ['organization_id', 'is_active'],
      }),
    );

    // Crear foreign key para organization
    await queryRunner.createForeignKey(
      'bank_accounts',
      new TableForeignKey({
        name: 'FK_bank_accounts_organization',
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign key
    await queryRunner.dropForeignKey('bank_accounts', 'FK_bank_accounts_organization');

    // Eliminar índices
    await queryRunner.dropIndex('bank_accounts', 'IDX_bank_accounts_active');
    await queryRunner.dropIndex('bank_accounts', 'IDX_bank_accounts_organization');

    // Eliminar tabla
    await queryRunner.dropTable('bank_accounts');

    // Eliminar el tipo enum
    await queryRunner.query(`DROP TYPE "public"."bank_accounts_type_enum"`);
  }
}
