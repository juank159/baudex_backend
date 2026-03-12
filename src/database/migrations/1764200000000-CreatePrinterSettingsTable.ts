import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrinterSettingsTable1764200000000
  implements MigrationInterface
{
  name = 'CreatePrinterSettingsTable1764200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear enums
    await queryRunner.query(
      `CREATE TYPE "printer_connection_type_enum" AS ENUM('network', 'usb')`,
    );
    await queryRunner.query(
      `CREATE TYPE "printer_paper_size_enum" AS ENUM('mm58', 'mm80')`,
    );

    // Crear tabla
    await queryRunner.query(`
      CREATE TABLE "printer_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        "name" varchar(100) NOT NULL,
        "connection_type" "printer_connection_type_enum" NOT NULL DEFAULT 'network',
        "ip_address" varchar(45),
        "port" int DEFAULT 9100,
        "usb_path" varchar(255),
        "paper_size" "printer_paper_size_enum" NOT NULL DEFAULT 'mm80',
        "auto_cut" boolean NOT NULL DEFAULT true,
        "cash_drawer" boolean NOT NULL DEFAULT false,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "organization_id" uuid NOT NULL,
        CONSTRAINT "PK_printer_settings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_printer_settings_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    // Crear índices
    await queryRunner.query(
      `CREATE INDEX "IDX_printer_settings_org_active" ON "printer_settings" ("organization_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_printer_settings_org_id" ON "printer_settings" ("organization_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "printer_settings"`);
    await queryRunner.query(`DROP TYPE "printer_connection_type_enum"`);
    await queryRunner.query(`DROP TYPE "printer_paper_size_enum"`);
  }
}
