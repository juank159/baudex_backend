import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega idempotency_key a la tabla payments para prevenir duplicados en re-sync offline.
 * El frontend genera un UUID v4 por cada pago local; el backend rechaza (via unique constraint)
 * cualquier re-intento con la misma clave dentro de la organización.
 */
export class AddIdempotencyKeyToPayments1765300000000 implements MigrationInterface {
  name = 'AddIdempotencyKeyToPayments1765300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'idempotency_key'
    `);

    if (columnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "payments"
        ADD COLUMN "idempotency_key" varchar(64) NULL
      `);
    }

    const indexExists = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'payments' AND indexname = 'UQ_payments_org_idempotency'
    `);

    if (indexExists.length === 0) {
      // Unique parcial: solo aplica cuando idempotency_key NO es NULL.
      // Así los pagos legacy sin key no rompen la restricción.
      await queryRunner.query(`
        CREATE UNIQUE INDEX "UQ_payments_org_idempotency"
        ON "payments" ("organization_id", "idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
      `);
    }

    console.log('Migración AddIdempotencyKeyToPayments completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payments_org_idempotency"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "idempotency_key"`);
  }
}
