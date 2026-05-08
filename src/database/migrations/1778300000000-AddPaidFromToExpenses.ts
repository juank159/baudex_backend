import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: agrega `paid_from` y `bank_account_id` a la tabla `expenses`.
 *
 * Permite saber DE DÓNDE salió el dinero al pagar un gasto:
 *   - cash_register (caja del día)
 *   - bank_account (cuenta bancaria — requiere bank_account_id)
 *   - petty_cash (caja chica)
 *   - owner_capital (dueño paga de su bolsillo)
 *
 * Cierra el ciclo de flujo de caja: cuando el gasto se marca como pagado
 * con bank_account, el service descuenta del saldo y genera un movement
 * auditable `expense_payment`.
 */
export class AddPaidFromToExpenses1778300000000 implements MigrationInterface {
  name = 'AddPaidFromToExpenses1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum solo si no existe (idempotente).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expenses_paid_from_enum') THEN
          CREATE TYPE "public"."expenses_paid_from_enum" AS ENUM (
            'cash_register',
            'bank_account',
            'petty_cash',
            'owner_capital'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "paid_from" "public"."expenses_paid_from_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "bank_account_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_expenses_bank_account_id"
      ON "expenses" ("bank_account_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_bank_account_id"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN IF EXISTS "bank_account_id"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN IF EXISTS "paid_from"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."expenses_paid_from_enum"`);
  }
}
