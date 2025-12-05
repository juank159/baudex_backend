// src/database/migrations/1763960000000-AddDeletedAtToCreditPayments.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToCreditPayments1763960000000 implements MigrationInterface {
  name = 'AddDeletedAtToCreditPayments1763960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna deleted_at a credit_payments si no existe
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'credit_payments' AND column_name = 'deleted_at'
        ) THEN
          ALTER TABLE "credit_payments" ADD COLUMN "deleted_at" timestamp;
        END IF;
      END$$;
    `);

    // Crear índice para deleted_at
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_credit_payments_deleted_at" ON "credit_payments" ("deleted_at")
    `);

    console.log('✅ Columna deleted_at agregada a credit_payments');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_credit_payments_deleted_at"`);
    await queryRunner.query(`ALTER TABLE "credit_payments" DROP COLUMN IF EXISTS "deleted_at"`);

    console.log('✅ Columna deleted_at eliminada de credit_payments');
  }
}
