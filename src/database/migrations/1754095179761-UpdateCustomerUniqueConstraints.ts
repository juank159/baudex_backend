import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCustomerUniqueConstraints1754095179761
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing unique constraints on email and document
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "UQ_8536b8b85c06969f84f0c098b03"`,
    ); // email unique
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "UQ_f123456789abcdef0123456789ab"`,
    ); // document unique (example name)

    // Drop any other unique constraints on these fields by name pattern
    await queryRunner.query(`
            DO $$ 
            DECLARE 
                constraint_name TEXT;
            BEGIN
                -- Find and drop unique constraints on email column
                FOR constraint_name IN 
                    SELECT con.conname 
                    FROM pg_constraint con 
                    JOIN pg_class rel ON rel.oid = con.conrelid 
                    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
                    WHERE rel.relname = 'customers' 
                    AND con.contype = 'u' 
                    AND att.attname = 'email'
                LOOP
                    EXECUTE 'ALTER TABLE customers DROP CONSTRAINT IF EXISTS ' || constraint_name;
                END LOOP;
                
                -- Find and drop unique constraints on documentNumber column
                FOR constraint_name IN 
                    SELECT con.conname 
                    FROM pg_constraint con 
                    JOIN pg_class rel ON rel.oid = con.conrelid 
                    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
                    WHERE rel.relname = 'customers' 
                    AND con.contype = 'u' 
                    AND att.attname = 'documentNumber'
                LOOP
                    EXECUTE 'ALTER TABLE customers DROP CONSTRAINT IF EXISTS ' || constraint_name;
                END LOOP;
            END $$;
        `);

    // 2. Add new composite unique constraints scoped by organization
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_customer_email_organization" UNIQUE ("email", "organization_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_customer_document_organization" UNIQUE ("documentType", "documentNumber", "organization_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove composite constraints
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "UQ_customer_email_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "UQ_customer_document_organization"`,
    );

    // Restore original unique constraints (this might fail if there are duplicates)
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_8536b8b85c06969f84f0c098b03" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_customer_document_unique" UNIQUE ("documentNumber")`,
    );
  }
}
