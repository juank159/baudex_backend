// src/database/migrations/1763970000000-CreateClientBalanceTables.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientBalanceTables1763970000000 implements MigrationInterface {
  name = 'CreateClientBalanceTables1763970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla client_balances si no existe
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_balances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "balance" decimal(12,2) NOT NULL DEFAULT 0,
        "customer_id" uuid NOT NULL UNIQUE,
        "organization_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_client_balances" PRIMARY KEY ("id")
      )
    `);

    // 2. Crear enum para balance_transaction_type
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'balance_transaction_type_enum') THEN
          CREATE TYPE "balance_transaction_type_enum" AS ENUM (
            'deposit',
            'usage',
            'refund',
            'adjustment'
          );
        END IF;
      END$$;
    `);

    // 3. Crear tabla client_balance_transactions si no existe
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_balance_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "balance_transaction_type_enum" NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "description" text NOT NULL,
        "balance_after" decimal(12,2) NOT NULL,
        "payment_method" varchar(50),
        "client_balance_id" uuid NOT NULL,
        "related_credit_id" uuid,
        "organization_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_client_balance_transactions" PRIMARY KEY ("id")
      )
    `);

    // 4. Agregar foreign keys para client_balances (si no existen)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_balances_customer') THEN
          ALTER TABLE "client_balances"
          ADD CONSTRAINT "FK_client_balances_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_balances_organization') THEN
          ALTER TABLE "client_balances"
          ADD CONSTRAINT "FK_client_balances_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_balances_created_by') THEN
          ALTER TABLE "client_balances"
          ADD CONSTRAINT "FK_client_balances_created_by"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    // 5. Agregar foreign keys para client_balance_transactions (si no existen)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_balance_trans_balance') THEN
          ALTER TABLE "client_balance_transactions"
          ADD CONSTRAINT "FK_client_balance_trans_balance"
          FOREIGN KEY ("client_balance_id") REFERENCES "client_balances"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_balance_trans_credit') THEN
          ALTER TABLE "client_balance_transactions"
          ADD CONSTRAINT "FK_client_balance_trans_credit"
          FOREIGN KEY ("related_credit_id") REFERENCES "customer_credits"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_balance_trans_organization') THEN
          ALTER TABLE "client_balance_transactions"
          ADD CONSTRAINT "FK_client_balance_trans_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_balance_trans_created_by') THEN
          ALTER TABLE "client_balance_transactions"
          ADD CONSTRAINT "FK_client_balance_trans_created_by"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    // 6. Crear índices para client_balances
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_balances_customer" ON "client_balances" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_balances_organization" ON "client_balances" ("organization_id")
    `);

    // 7. Crear índices para client_balance_transactions
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_balance_trans_balance" ON "client_balance_transactions" ("client_balance_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_balance_trans_type" ON "client_balance_transactions" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_balance_trans_organization" ON "client_balance_transactions" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_balance_trans_created_at" ON "client_balance_transactions" ("created_at")
    `);

    console.log('✅ Tablas client_balances y client_balance_transactions creadas exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign keys de client_balance_transactions
    await queryRunner.query(`ALTER TABLE "client_balance_transactions" DROP CONSTRAINT IF EXISTS "FK_client_balance_trans_created_by"`);
    await queryRunner.query(`ALTER TABLE "client_balance_transactions" DROP CONSTRAINT IF EXISTS "FK_client_balance_trans_organization"`);
    await queryRunner.query(`ALTER TABLE "client_balance_transactions" DROP CONSTRAINT IF EXISTS "FK_client_balance_trans_credit"`);
    await queryRunner.query(`ALTER TABLE "client_balance_transactions" DROP CONSTRAINT IF EXISTS "FK_client_balance_trans_balance"`);

    // Eliminar foreign keys de client_balances
    await queryRunner.query(`ALTER TABLE "client_balances" DROP CONSTRAINT IF EXISTS "FK_client_balances_created_by"`);
    await queryRunner.query(`ALTER TABLE "client_balances" DROP CONSTRAINT IF EXISTS "FK_client_balances_organization"`);
    await queryRunner.query(`ALTER TABLE "client_balances" DROP CONSTRAINT IF EXISTS "FK_client_balances_customer"`);

    // Eliminar índices
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_balance_trans_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_balance_trans_organization"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_balance_trans_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_balance_trans_balance"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_balances_organization"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_balances_customer"`);

    // Eliminar tablas
    await queryRunner.query(`DROP TABLE IF EXISTS "client_balance_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "client_balances"`);

    // Eliminar enum
    await queryRunner.query(`DROP TYPE IF EXISTS "balance_transaction_type_enum"`);

    console.log('✅ Tablas client_balances y client_balance_transactions eliminadas');
  }
}
