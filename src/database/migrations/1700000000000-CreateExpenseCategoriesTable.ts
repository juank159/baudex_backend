import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpenseCategoriesTable1700000000000
  implements MigrationInterface
{
  name = 'CreateExpenseCategoriesTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear enum para el status de categorías de gastos
    await queryRunner.query(`
      CREATE TYPE "expense_categories_status_enum" AS ENUM(
        'active', 
        'inactive'
      )
    `);

    // 2. Crear tabla expense_categories
    await queryRunner.query(`
      CREATE TABLE "expense_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(100) NOT NULL,
        "description" text,
        "color" character varying(7),
        "status" "expense_categories_status_enum" NOT NULL DEFAULT 'active',
        "monthlyBudget" numeric(12,2) NOT NULL DEFAULT 0,
        "isRequired" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "organization_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_expense_categories" PRIMARY KEY ("id")
      )
    `);

    // 3. Crear índices
    await queryRunner.query(`
      CREATE INDEX "IDX_expense_categories_organization" 
      ON "expense_categories" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expense_categories_status" 
      ON "expense_categories" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expense_categories_sort_order" 
      ON "expense_categories" ("sortOrder")
    `);

    // 4. Agregar foreign key constraint (asumiendo que organizations ya existe)
    await queryRunner.query(`
      ALTER TABLE "expense_categories" 
      ADD CONSTRAINT "FK_expense_categories_organization" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "expense_categories" 
      DROP CONSTRAINT "FK_expense_categories_organization"
    `);

    // 2. Eliminar índices
    await queryRunner.query(`
      DROP INDEX "IDX_expense_categories_sort_order"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expense_categories_status"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expense_categories_organization"
    `);

    // 3. Eliminar tabla
    await queryRunner.query(`
      DROP TABLE "expense_categories"
    `);

    // 4. Eliminar enum
    await queryRunner.query(`
      DROP TYPE "expense_categories_status_enum"
    `);
  }
}