import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCustomerUniqueConstraintsForSoftDelete1754096651495
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar constraints únicos existentes que incluyen registros soft-deleted
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "UQ_customer_email_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "UQ_customer_document_organization"`,
    );

    // 2. Crear índices únicos parciales que excluyen registros soft-deleted
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_customer_email_organization_active" 
            ON "customers" ("email", "organization_id") 
            WHERE "deleted_at" IS NULL
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_customer_document_organization_active" 
            ON "customers" ("documentType", "documentNumber", "organization_id") 
            WHERE "deleted_at" IS NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar índices únicos parciales
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_customer_email_organization_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_customer_document_organization_active"`,
    );

    // 2. Restaurar constraints únicos originales (esto podría fallar si hay duplicados)
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_customer_email_organization" UNIQUE ("email", "organization_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_customer_document_organization" UNIQUE ("documentType", "documentNumber", "organization_id")`,
    );
  }
}
