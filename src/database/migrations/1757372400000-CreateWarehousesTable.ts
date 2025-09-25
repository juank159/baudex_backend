import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWarehousesTable1757372400000 implements MigrationInterface {
  name = 'CreateWarehousesTable1757372400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla warehouses
    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "code" varchar(20) NOT NULL,
        "description" text,
        "address" text,
        "is_active" boolean DEFAULT true,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamp
      )
    `);

    // Crear índices
    await queryRunner.query(`
      CREATE INDEX "IDX_warehouses_organization_id" ON "warehouses" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_warehouses_code_organization_id" 
      ON "warehouses" ("code", "organization_id") 
      WHERE "deleted_at" IS NULL
    `);

    // Crear foreign key hacia organizations
    await queryRunner.query(`
      ALTER TABLE "warehouses" 
      ADD CONSTRAINT "FK_warehouses_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    // Agregar columna warehouse_id a la tabla inventory_movements
    await queryRunner.query(`
      ALTER TABLE "inventory_movements" 
      ADD COLUMN "warehouse_id" uuid
    `);

    // Crear índice para warehouse_id en inventory_movements
    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_movements_warehouse_id" 
      ON "inventory_movements" ("warehouse_id")
    `);

    // Crear foreign key desde inventory_movements hacia warehouses
    await queryRunner.query(`
      ALTER TABLE "inventory_movements" 
      ADD CONSTRAINT "FK_inventory_movements_warehouse_id" 
      FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL
    `);

    // Crear almacenes por defecto para cada organización existente
    const organizations = await queryRunner.query(
      'SELECT id, name FROM organizations WHERE deleted_at IS NULL',
    );

    for (const org of organizations) {
      // Almacén principal
      await queryRunner.query(`
        INSERT INTO warehouses (name, code, description, organization_id, is_active, created_at, updated_at) 
        VALUES ('Almacén Principal', 'ALM-001', 'Almacén central de la empresa', '${org.id}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      // Almacén secundario
      await queryRunner.query(`
        INSERT INTO warehouses (name, code, description, organization_id, is_active, created_at, updated_at) 
        VALUES ('Almacén Secundario', 'ALM-002', 'Almacén de respaldo y distribución', '${org.id}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign key y columna de inventory_movements
    await queryRunner.query(`
      ALTER TABLE "inventory_movements" 
      DROP CONSTRAINT IF EXISTS "FK_inventory_movements_warehouse_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_inventory_movements_warehouse_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_movements" 
      DROP COLUMN IF EXISTS "warehouse_id"
    `);

    // Eliminar tabla warehouses
    await queryRunner.query(`
      ALTER TABLE "warehouses" 
      DROP CONSTRAINT IF EXISTS "FK_warehouses_organization_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_warehouses_code_organization_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_warehouses_organization_id"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "warehouses"
    `);
  }
}
