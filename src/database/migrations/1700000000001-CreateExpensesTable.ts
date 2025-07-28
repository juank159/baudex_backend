import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpensesTable1700000000001 implements MigrationInterface {
  name = 'CreateExpensesTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear enums para expenses
    await queryRunner.query(`
      CREATE TYPE "expenses_status_enum" AS ENUM(
        'draft', 
        'pending', 
        'approved', 
        'rejected', 
        'paid'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "expenses_type_enum" AS ENUM(
        'operating', 
        'administrative', 
        'sales', 
        'financial', 
        'extraordinary'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "expenses_paymentmethod_enum" AS ENUM(
        'cash', 
        'credit_card', 
        'debit_card', 
        'bank_transfer', 
        'check', 
        'other'
      )
    `);

    // 2. Crear tabla expenses
    await queryRunner.query(`
      CREATE TABLE "expenses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "description" character varying(200) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "date" date NOT NULL,
        "status" "expenses_status_enum" NOT NULL DEFAULT 'draft',
        "type" "expenses_type_enum" NOT NULL DEFAULT 'operating',
        "paymentMethod" "expenses_paymentmethod_enum" NOT NULL DEFAULT 'cash',
        "vendor" character varying(100),
        "invoiceNumber" character varying(50),
        "reference" character varying(100),
        "notes" text,
        "attachments" json,
        "tags" json,
        "metadata" json,
        "approvedById" uuid,
        "approvedAt" TIMESTAMP,
        "rejectionReason" text,
        "organization_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_expenses" PRIMARY KEY ("id")
      )
    `);

    // 3. Crear índices
    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_organization" 
      ON "expenses" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_category" 
      ON "expenses" ("category_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_created_by" 
      ON "expenses" ("created_by_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_approved_by" 
      ON "expenses" ("approved_by_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_status" 
      ON "expenses" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_type" 
      ON "expenses" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_date" 
      ON "expenses" ("date")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_amount" 
      ON "expenses" ("amount")
    `);

    // 4. Agregar foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "expenses" 
      ADD CONSTRAINT "FK_expenses_organization" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses" 
      ADD CONSTRAINT "FK_expenses_category" 
      FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses" 
      ADD CONSTRAINT "FK_expenses_created_by" 
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses" 
      ADD CONSTRAINT "FK_expenses_approved_by" 
      FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "expenses" 
      DROP CONSTRAINT "FK_expenses_approved_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses" 
      DROP CONSTRAINT "FK_expenses_created_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses" 
      DROP CONSTRAINT "FK_expenses_category"
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses" 
      DROP CONSTRAINT "FK_expenses_organization"
    `);

    // 2. Eliminar índices
    await queryRunner.query(`
      DROP INDEX "IDX_expenses_amount"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expenses_date"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expenses_type"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expenses_status"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expenses_approved_by"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expenses_created_by"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expenses_category"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expenses_organization"
    `);

    // 3. Eliminar tabla
    await queryRunner.query(`
      DROP TABLE "expenses"
    `);

    // 4. Eliminar enums
    await queryRunner.query(`
      DROP TYPE "expenses_paymentmethod_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "expenses_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "expenses_status_enum"
    `);
  }
}