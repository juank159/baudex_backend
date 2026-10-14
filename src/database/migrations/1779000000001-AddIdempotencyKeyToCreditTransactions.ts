import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega idempotency_key a credit_transactions para que un aumento de deuda
 * reenviado por la app (reintento, cola offline) no se aplique dos veces.
 * Mismo patrón que AddIdempotencyKeyToCreditPayments.
 */
export class AddIdempotencyKeyToCreditTransactions1779000000001 implements MigrationInterface {
  name = 'AddIdempotencyKeyToCreditTransactions1779000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'credit_transactions' AND column_name = 'idempotency_key'
    `);

    if (columnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "credit_transactions"
        ADD COLUMN "idempotency_key" varchar(64) NULL
      `);
    }

    const indexExists = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'credit_transactions' AND indexname = 'UQ_credit_transactions_org_idempotency'
    `);

    if (indexExists.length === 0) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX "UQ_credit_transactions_org_idempotency"
        ON "credit_transactions" ("organization_id", "idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
      `);
    }

    console.log('Migración AddIdempotencyKeyToCreditTransactions completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_credit_transactions_org_idempotency"`);
    await queryRunner.query(`ALTER TABLE "credit_transactions" DROP COLUMN IF EXISTS "idempotency_key"`);
  }
}
