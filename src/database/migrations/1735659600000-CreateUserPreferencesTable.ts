import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPreferencesTable1735659600000
  implements MigrationInterface
{
  name = 'CreateUserPreferencesTable1735659600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la extensión uuid-ossp existe
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Crear tabla user_preferences usando SQL directo
    await queryRunner.query(`
      CREATE TABLE "user_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "auto_deduct_inventory" boolean DEFAULT true,
        "use_fifo_costing" boolean DEFAULT true,
        "validate_stock_before_invoice" boolean DEFAULT true,
        "allow_overselling" boolean DEFAULT false,
        "show_stock_warnings" boolean DEFAULT true,
        "show_confirmation_dialogs" boolean DEFAULT true,
        "use_compact_mode" boolean DEFAULT false,
        "enable_expiry_notifications" boolean DEFAULT true,
        "enable_low_stock_notifications" boolean DEFAULT true,
        "default_warehouse_id" uuid,
        "additional_settings" jsonb,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // Crear índices
    await queryRunner.query(`
      CREATE INDEX "IDX_user_preferences_user_id" ON "user_preferences" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_preferences_organization_id" ON "user_preferences" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_preferences_user_org" ON "user_preferences" ("user_id", "organization_id")
    `);

    // Crear claves foráneas
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD CONSTRAINT "FK_user_preferences_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD CONSTRAINT "FK_user_preferences_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar tabla (esto también elimina índices y claves foráneas automáticamente)
    await queryRunner.query(`DROP TABLE "user_preferences"`);
  }
}
