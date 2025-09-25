import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationsAndAddTenantSupport1734567890123
  implements MigrationInterface
{
  name = 'CreateOrganizationsAndAddTenantSupport1734567890123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla organizations
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "domain" character varying(255),
        "logo" text,
        "settings" jsonb NOT NULL DEFAULT '{}',
        "subscriptionPlan" character varying NOT NULL DEFAULT 'basic',
        "isActive" boolean NOT NULL DEFAULT true,
        "currency" character varying(10) NOT NULL DEFAULT 'USD',
        "locale" character varying(10) NOT NULL DEFAULT 'en',
        "timezone" character varying(50) NOT NULL DEFAULT 'America/New_York',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);

    // 2. Crear índices únicos para organizations
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_organizations_slug" ON "organizations" ("slug") WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_organizations_domain" ON "organizations" ("domain") WHERE "deletedAt" IS NULL AND "domain" IS NOT NULL
    `);

    // 3. Crear organización por defecto
    await queryRunner.query(`
      INSERT INTO "organizations" ("name", "slug", "subscriptionPlan", "isActive") 
      VALUES ('Default Organization', 'default', 'enterprise', true)
    `);

    // 4. Agregar organization_id a tabla users
    await queryRunner.query(`
      ALTER TABLE "users" ADD "organization_id" uuid
    `);

    // 5. Asignar organización por defecto a usuarios existentes
    await queryRunner.query(`
      UPDATE "users" SET "organization_id" = (
        SELECT "id" FROM "organizations" WHERE "slug" = 'default' LIMIT 1
      )
    `);

    // 6. Hacer organization_id NOT NULL después de asignar valores
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL
    `);

    // 7. Agregar foreign key constraint para users
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_organization" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT
    `);

    // 8. Crear índice para users.organization_id
    await queryRunner.query(`
      CREATE INDEX "IDX_users_organization" ON "users" ("organization_id")
    `);

    // 9. Agregar organization_id a todas las tablas principales
    const tablesToUpdate = [
      'products',
      'customers',
      'categories',
      'invoices',
      'invoice_items',
      'expenses',
      'expense_categories',
    ];

    for (const tableName of tablesToUpdate) {
      // Verificar si la tabla existe antes de modificarla
      const tableExists = await queryRunner.hasTable(tableName);
      if (tableExists) {
        // Agregar columna organization_id
        await queryRunner.query(`
          ALTER TABLE "${tableName}" ADD "organization_id" uuid
        `);

        // Asignar organización por defecto a registros existentes
        await queryRunner.query(`
          UPDATE "${tableName}" SET "organization_id" = (
            SELECT "id" FROM "organizations" WHERE "slug" = 'default' LIMIT 1
          )
        `);

        // Hacer organization_id NOT NULL
        await queryRunner.query(`
          ALTER TABLE "${tableName}" ALTER COLUMN "organization_id" SET NOT NULL
        `);

        // Agregar foreign key constraint
        await queryRunner.query(`
          ALTER TABLE "${tableName}" 
          ADD CONSTRAINT "FK_${tableName}_organization" 
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT
        `);

        // Crear índice para performance
        await queryRunner.query(`
          CREATE INDEX "IDX_${tableName}_organization" ON "${tableName}" ("organization_id")
        `);
      }
    }

    // 10. Modificar índices únicos existentes para incluir organization_id

    // Para categories (slug debe ser único por organización)
    if (await queryRunner.hasTable('categories')) {
      // Eliminar índice único anterior si existe
      try {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_slug"`);
      } catch (error) {
        // Ignorar si no existe
      }

      // Crear nuevo índice único compuesto
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_categories_slug_organization" 
        ON "categories" ("slug", "organization_id") 
        WHERE "deletedAt" IS NULL
      `);
    }

    // Para products (sku debe ser único por organización)
    if (await queryRunner.hasTable('products')) {
      try {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_sku"`);
      } catch (error) {
        // Ignorar si no existe
      }

      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_products_sku_organization" 
        ON "products" ("sku", "organization_id") 
        WHERE "deletedAt" IS NULL AND "sku" IS NOT NULL
      `);
    }

    // Para customers (email debe ser único por organización)
    if (await queryRunner.hasTable('customers')) {
      try {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_email"`);
      } catch (error) {
        // Ignorar si no existe
      }

      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_customers_email_organization" 
        ON "customers" ("email", "organization_id") 
        WHERE "deletedAt" IS NULL AND "email" IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cambios en orden inverso

    // 1. Eliminar foreign keys y columnas organization_id de todas las tablas
    const tablesToRevert = [
      'users',
      'products',
      'customers',
      'categories',
      'invoices',
      'invoice_items',
      'expenses',
      'expense_categories',
    ];

    for (const tableName of tablesToRevert) {
      const tableExists = await queryRunner.hasTable(tableName);
      if (tableExists) {
        // Eliminar foreign key constraint
        await queryRunner.query(`
          ALTER TABLE "${tableName}" 
          DROP CONSTRAINT IF EXISTS "FK_${tableName}_organization"
        `);

        // Eliminar índice
        await queryRunner.query(`
          DROP INDEX IF EXISTS "IDX_${tableName}_organization"
        `);

        // Eliminar columna
        await queryRunner.query(`
          ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "organization_id"
        `);
      }
    }

    // 2. Restaurar índices únicos originales
    if (await queryRunner.hasTable('categories')) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_categories_slug_organization"`,
      );
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_categories_slug" ON "categories" ("slug") 
        WHERE "deletedAt" IS NULL
      `);
    }

    if (await queryRunner.hasTable('products')) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_products_sku_organization"`,
      );
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_products_sku" ON "products" ("sku") 
        WHERE "deletedAt" IS NULL AND "sku" IS NOT NULL
      `);
    }

    if (await queryRunner.hasTable('customers')) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_customers_email_organization"`,
      );
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_customers_email" ON "customers" ("email") 
        WHERE "deletedAt" IS NULL AND "email" IS NOT NULL
      `);
    }

    // 3. Eliminar tabla organizations
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_domain"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_slug"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
