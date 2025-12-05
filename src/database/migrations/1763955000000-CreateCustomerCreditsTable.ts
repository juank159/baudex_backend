// src/database/migrations/1763955000000-CreateCustomerCreditsTable.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerCreditsTable1763955000000 implements MigrationInterface {
  name = 'CreateCustomerCreditsTable1763955000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear enum para el estado del crédito
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_status_enum') THEN
          CREATE TYPE "credit_status_enum" AS ENUM (
            'pending',
            'partially_paid',
            'paid',
            'cancelled',
            'overdue'
          );
        END IF;
      END$$;
    `);

    // 2. Crear tabla customer_credits
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_credits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "original_amount" decimal(12,2) NOT NULL,
        "paid_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "balance_due" decimal(12,2) NOT NULL,
        "status" "credit_status_enum" NOT NULL DEFAULT 'pending',
        "due_date" date,
        "description" text,
        "notes" text,
        "customer_id" uuid NOT NULL,
        "invoice_id" uuid,
        "organization_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "deleted_at" timestamp,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_credits" PRIMARY KEY ("id")
      )
    `);

    // 3. Crear tabla credit_payments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "amount" decimal(12,2) NOT NULL,
        "payment_method" varchar(50) NOT NULL,
        "payment_date" timestamp NOT NULL DEFAULT now(),
        "reference" varchar(255),
        "notes" text,
        "credit_id" uuid NOT NULL,
        "bank_account_id" uuid,
        "organization_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_payments" PRIMARY KEY ("id")
      )
    `);

    // 4. Agregar foreign keys para customer_credits
    await queryRunner.query(`
      ALTER TABLE "customer_credits"
      ADD CONSTRAINT "FK_customer_credits_customer"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_credits"
      ADD CONSTRAINT "FK_customer_credits_invoice"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_credits"
      ADD CONSTRAINT "FK_customer_credits_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_credits"
      ADD CONSTRAINT "FK_customer_credits_created_by"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 5. Agregar foreign keys para credit_payments
    await queryRunner.query(`
      ALTER TABLE "credit_payments"
      ADD CONSTRAINT "FK_credit_payments_credit"
      FOREIGN KEY ("credit_id") REFERENCES "customer_credits"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_payments"
      ADD CONSTRAINT "FK_credit_payments_bank_account"
      FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_payments"
      ADD CONSTRAINT "FK_credit_payments_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_payments"
      ADD CONSTRAINT "FK_credit_payments_created_by"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 6. Crear índices para customer_credits
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_credits_customer" ON "customer_credits" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_credits_organization" ON "customer_credits" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_credits_status" ON "customer_credits" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_credits_due_date" ON "customer_credits" ("due_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_credits_deleted_at" ON "customer_credits" ("deleted_at")
    `);

    // 7. Crear índices para credit_payments
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_payments_credit" ON "credit_payments" ("credit_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_payments_organization" ON "credit_payments" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_payments_payment_date" ON "credit_payments" ("payment_date")
    `);

    // 8. Agregar columna credit_balance a customers si no existe
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'credit_balance'
        ) THEN
          ALTER TABLE "customers" ADD COLUMN "credit_balance" decimal(12,2) NOT NULL DEFAULT 0;
        END IF;
      END$$;
    `);

    console.log('✅ Tablas customer_credits y credit_payments creadas exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign keys de credit_payments
    await queryRunner.query(`ALTER TABLE "credit_payments" DROP CONSTRAINT IF EXISTS "FK_credit_payments_created_by"`);
    await queryRunner.query(`ALTER TABLE "credit_payments" DROP CONSTRAINT IF EXISTS "FK_credit_payments_organization"`);
    await queryRunner.query(`ALTER TABLE "credit_payments" DROP CONSTRAINT IF EXISTS "FK_credit_payments_bank_account"`);
    await queryRunner.query(`ALTER TABLE "credit_payments" DROP CONSTRAINT IF EXISTS "FK_credit_payments_credit"`);

    // Eliminar foreign keys de customer_credits
    await queryRunner.query(`ALTER TABLE "customer_credits" DROP CONSTRAINT IF EXISTS "FK_customer_credits_created_by"`);
    await queryRunner.query(`ALTER TABLE "customer_credits" DROP CONSTRAINT IF EXISTS "FK_customer_credits_organization"`);
    await queryRunner.query(`ALTER TABLE "customer_credits" DROP CONSTRAINT IF EXISTS "FK_customer_credits_invoice"`);
    await queryRunner.query(`ALTER TABLE "customer_credits" DROP CONSTRAINT IF EXISTS "FK_customer_credits_customer"`);

    // Eliminar índices
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_payments_payment_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_payments_organization"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_payments_credit"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customer_credits_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customer_credits_due_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customer_credits_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customer_credits_organization"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customer_credits_customer"`);

    // Eliminar tablas
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_credits"`);

    // Eliminar enum
    await queryRunner.query(`DROP TYPE IF EXISTS "credit_status_enum"`);

    // Eliminar columna credit_balance de customers
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "credit_balance"`);

    console.log('✅ Tablas customer_credits y credit_payments eliminadas');
  }
}
