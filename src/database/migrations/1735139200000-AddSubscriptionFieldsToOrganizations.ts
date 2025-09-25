import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionFieldsToOrganizations1735139200000
  implements MigrationInterface
{
  name = 'AddSubscriptionFieldsToOrganizations1735139200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columnas de suscripción si no existen
    await queryRunner.query(`
      DO $$ 
      BEGIN
        -- Agregar columna subscriptionPlan si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organizations' AND column_name = 'subscriptionPlan'
        ) THEN
          ALTER TABLE "organizations" ADD "subscriptionPlan" character varying DEFAULT 'trial';
        END IF;

        -- Agregar columna subscriptionStatus si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organizations' AND column_name = 'subscriptionStatus'
        ) THEN
          ALTER TABLE "organizations" ADD "subscriptionStatus" character varying DEFAULT 'active';
        END IF;

        -- Agregar columna subscriptionStartDate si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organizations' AND column_name = 'subscriptionStartDate'
        ) THEN
          ALTER TABLE "organizations" ADD "subscriptionStartDate" timestamp;
        END IF;

        -- Agregar columna subscriptionEndDate si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organizations' AND column_name = 'subscriptionEndDate'
        ) THEN
          ALTER TABLE "organizations" ADD "subscriptionEndDate" timestamp;
        END IF;

        -- Agregar columna trialStartDate si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organizations' AND column_name = 'trialStartDate'
        ) THEN
          ALTER TABLE "organizations" ADD "trialStartDate" timestamp;
        END IF;

        -- Agregar columna trialEndDate si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organizations' AND column_name = 'trialEndDate'
        ) THEN
          ALTER TABLE "organizations" ADD "trialEndDate" timestamp;
        END IF;
      END $$;
    `);

    // Inicializar período de prueba para organizaciones existentes que no lo tengan
    await queryRunner.query(`
      UPDATE "organizations" 
      SET 
        "subscriptionPlan" = 'trial',
        "subscriptionStatus" = 'active',
        "trialStartDate" = COALESCE("createdAt", NOW()),
        "trialEndDate" = COALESCE("createdAt", NOW()) + INTERVAL '30 days'
      WHERE 
        "trialStartDate" IS NULL 
        OR "trialEndDate" IS NULL
        OR "subscriptionPlan" IS NULL;
    `);

    console.log(
      '✅ Migración completada: Se agregaron campos de suscripción y se inicializaron períodos de prueba',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover columnas de suscripción
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN IF EXISTS "trialEndDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN IF EXISTS "trialStartDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN IF EXISTS "subscriptionEndDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN IF EXISTS "subscriptionStartDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN IF EXISTS "subscriptionStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN IF EXISTS "subscriptionPlan"`,
    );
  }
}
