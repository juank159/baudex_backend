import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiCurrencySupport1764500000000 implements MigrationInterface {
  name = 'AddMultiCurrencySupport1764500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Agregar columna multiCurrencyEnabled a organizations
    const orgColumnExists = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'organizations' AND column_name = 'multiCurrencyEnabled'
    `);

    if (orgColumnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "organizations"
        ADD COLUMN "multiCurrencyEnabled" boolean NOT NULL DEFAULT false
      `);
      console.log('✅ Columna multiCurrencyEnabled agregada a organizations');
    }

    // 2. Agregar columnas de multi-moneda a payments
    // Verificar paymentCurrency
    const paymentCurrencyExists = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'paymentCurrency'
    `);

    if (paymentCurrencyExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "payments"
        ADD COLUMN "paymentCurrency" varchar(10) NULL
      `);
      console.log('✅ Columna paymentCurrency agregada a payments');
    }

    // Verificar paymentCurrencyAmount
    const paymentCurrencyAmountExists = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'paymentCurrencyAmount'
    `);

    if (paymentCurrencyAmountExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "payments"
        ADD COLUMN "paymentCurrencyAmount" float NULL
      `);
      console.log('✅ Columna paymentCurrencyAmount agregada a payments');
    }

    // Verificar exchangeRate
    const exchangeRateExists = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'exchangeRate'
    `);

    if (exchangeRateExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "payments"
        ADD COLUMN "exchangeRate" float NULL
      `);
      console.log('✅ Columna exchangeRate agregada a payments');
    }

    console.log('✅ Migración AddMultiCurrencySupport completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar columnas de payments
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "exchangeRate"
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "paymentCurrencyAmount"
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "paymentCurrency"
    `);

    // Eliminar columna de organizations
    await queryRunner.query(`
      ALTER TABLE "organizations"
      DROP COLUMN IF EXISTS "multiCurrencyEnabled"
    `);

    console.log('✅ Rollback AddMultiCurrencySupport completado');
  }
}
