import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega idempotency_key a credit_payments para que un abono reenviado por la
 * app (reintento, cola offline, doble envío) no se registre dos veces.
 * Mismo patrón que AddIdempotencyKeyToPayments: el cliente genera una clave
 * por abono y el índice único parcial rechaza el segundo intento dentro de la
 * organización. Los abonos anteriores (sin clave) no se ven afectados.
 */
export class AddIdempotencyKeyToCreditPayments1779000000000 implements MigrationInterface {
  name = 'AddIdempotencyKeyToCreditPayments1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'credit_payments' AND column_name = 'idempotency_key'
    `);

    if (columnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "credit_payments"
        ADD COLUMN "idempotency_key" varchar(64) NULL
      `);
    }

    const indexExists = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'credit_payments' AND indexname = 'UQ_credit_payments_org_idempotency'
    `);

    if (indexExists.length === 0) {
      // Unique parcial: solo aplica cuando idempotency_key NO es NULL.
      await queryRunner.query(`
        CREATE UNIQUE INDEX "UQ_credit_payments_org_idempotency"
        ON "credit_payments" ("organization_id", "idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
      `);
    }

    console.log('Migración AddIdempotencyKeyToCreditPayments completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_credit_payments_org_idempotency"`);
    await queryRunner.query(`ALTER TABLE "credit_payments" DROP COLUMN IF EXISTS "idempotency_key"`);
  }
}
