// src/database/migrations/1763965000000-CreateCreditTransactionsTable.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCreditTransactionsTable1763965000000 implements MigrationInterface {
  name = 'CreateCreditTransactionsTable1763965000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear enum para el tipo de transacción
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_transaction_type_enum') THEN
          CREATE TYPE "credit_transaction_type_enum" AS ENUM (
            'charge',
            'debt_increase',
            'payment',
            'balance_used'
          );
        END IF;
      END$$;
    `);

    // 2. Crear tabla credit_transactions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "credit_transaction_type_enum" NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "description" text,
        "balance_after" decimal(12,2) NOT NULL,
        "payment_method" varchar(50),
        "credit_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_transactions" PRIMARY KEY ("id")
      )
    `);

    // 3. Agregar foreign keys
    await queryRunner.query(`
      ALTER TABLE "credit_transactions"
      ADD CONSTRAINT "FK_credit_transactions_credit"
      FOREIGN KEY ("credit_id") REFERENCES "customer_credits"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_transactions"
      ADD CONSTRAINT "FK_credit_transactions_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_transactions"
      ADD CONSTRAINT "FK_credit_transactions_created_by"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 4. Crear índices
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_transactions_credit" ON "credit_transactions" ("credit_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_transactions_type" ON "credit_transactions" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_transactions_organization" ON "credit_transactions" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_transactions_created_at" ON "credit_transactions" ("created_at")
    `);

    console.log('✅ Tabla credit_transactions creada exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign keys
    await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "FK_credit_transactions_created_by"`);
    await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "FK_credit_transactions_organization"`);
    await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "FK_credit_transactions_credit"`);

    // Eliminar índices
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_transactions_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_transactions_organization"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_transactions_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_transactions_credit"`);

    // Eliminar tabla
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_transactions"`);

    // Eliminar enum
    await queryRunner.query(`DROP TYPE IF EXISTS "credit_transaction_type_enum"`);

    console.log('✅ Tabla credit_transactions eliminada');
  }
}
