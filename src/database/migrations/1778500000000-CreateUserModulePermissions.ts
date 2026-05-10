import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUserModulePermissions1778500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_module_permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'module_code',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'can_view',
            type: 'boolean',
            default: false,
          },
          {
            name: 'can_edit',
            type: 'boolean',
            default: false,
          },
          {
            name: 'can_delete',
            type: 'boolean',
            default: false,
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
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniques: [
          {
            name: 'UQ_user_module_permissions_user_module',
            columnNames: ['user_id', 'module_code'],
          },
        ],
        indices: [
          {
            name: 'IDX_user_module_permissions_organization_id',
            columnNames: ['organization_id'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_module_permissions', true);
  }
}
