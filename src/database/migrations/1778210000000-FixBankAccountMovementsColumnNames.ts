import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix nombres de columnas timestamp en `bank_account_movements`.
 *
 * La migración previa creó las columnas como `createdAt`, `updatedAt`,
 * `deletedAt` (camelCase) pero la `BaseEntity` las mapea a snake_case
 * (`created_at`, `updated_at`, `deleted_at`). Esto causaba el error en
 * runtime: `column "created_at" of relation "bank_account_movements" does not exist`.
 */
export class FixBankAccountMovementsColumnNames1778210000000
  implements MigrationInterface
{
  name = 'FixBankAccountMovementsColumnNames1778210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Renombrar solo si la columna camelCase existe (idempotencia)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bank_account_movements' AND column_name = 'createdAt'
        ) THEN
          ALTER TABLE "bank_account_movements" RENAME COLUMN "createdAt" TO "created_at";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bank_account_movements' AND column_name = 'updatedAt'
        ) THEN
          ALTER TABLE "bank_account_movements" RENAME COLUMN "updatedAt" TO "updated_at";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bank_account_movements' AND column_name = 'deletedAt'
        ) THEN
          ALTER TABLE "bank_account_movements" RENAME COLUMN "deletedAt" TO "deleted_at";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bank_account_movements' AND column_name = 'created_at'
        ) THEN
          ALTER TABLE "bank_account_movements" RENAME COLUMN "created_at" TO "createdAt";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bank_account_movements' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE "bank_account_movements" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bank_account_movements' AND column_name = 'deleted_at'
        ) THEN
          ALTER TABLE "bank_account_movements" RENAME COLUMN "deleted_at" TO "deletedAt";
        END IF;
      END $$;
    `);
  }
}
