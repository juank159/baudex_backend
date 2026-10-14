import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla del registro global de idempotencia (IdempotencyInterceptor).
 *
 * Guarda, por organización, cada operación de escritura que la app envió con
 * el header `Idempotency-Key` y la respuesta que recibió, para que un
 * reenvío de la misma operación (cola offline, reintento por timeout, doble
 * toque) devuelva esa respuesta en vez de ejecutarse de nuevo.
 */
export class CreateIdempotencyKeysTable1779000000002 implements MigrationInterface {
  name = 'CreateIdempotencyKeysTable1779000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "key_hash" varchar(64) NOT NULL,
        "method" varchar(10) NOT NULL,
        "path" varchar(500) NOT NULL,
        "user_id" uuid NULL,
        "status" varchar(16) NOT NULL DEFAULT 'processing',
        "response" json NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz NULL,
        CONSTRAINT "PK_idempotency_keys" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_keys_org_key"
      ON "idempotency_keys" ("organization_id", "key_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_idempotency_keys_created_at"
      ON "idempotency_keys" ("created_at")
    `);

    console.log('Migración CreateIdempotencyKeysTable completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
  }
}
