import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega soporte multi-moneda a las órdenes de compra, mismo patrón usado en
 * `payments` (migración 1764500000000-AddMultiCurrencySupport):
 *
 *   - `purchaseCurrency`       : código ISO de la moneda (ej: USD, VES). null = moneda base
 *   - `purchaseCurrencyAmount` : total en la moneda extranjera
 *   - `exchangeRate`           : 1 moneda extranjera = X moneda base
 *
 * `total` (ya existente) sigue siendo la verdad contable en la moneda base
 * de la organización (típicamente COP). Los 3 nuevos campos solo se llenan
 * cuando el usuario compra en otra moneda y sirven para reportes del tipo
 * "cuánto gasté este mes en USD vs VES".
 *
 * Idempotente: verifica existencia antes de agregar.
 */
export class AddMultiCurrencyToPurchaseOrders1776830000000
  implements MigrationInterface
{
  name = 'AddMultiCurrencyToPurchaseOrders1776830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const purchaseCurrencyExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders' AND column_name = 'purchaseCurrency'
    `);
    if (purchaseCurrencyExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "purchase_orders" ADD COLUMN "purchaseCurrency" varchar(10) NULL`,
      );
      console.log('✅ purchaseCurrency agregada a purchase_orders');
    }

    const purchaseCurrencyAmountExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders' AND column_name = 'purchaseCurrencyAmount'
    `);
    if (purchaseCurrencyAmountExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "purchase_orders" ADD COLUMN "purchaseCurrencyAmount" float NULL`,
      );
      console.log('✅ purchaseCurrencyAmount agregada a purchase_orders');
    }

    const exchangeRateExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders' AND column_name = 'exchangeRate'
    `);
    if (exchangeRateExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "purchase_orders" ADD COLUMN "exchangeRate" float NULL`,
      );
      console.log('✅ exchangeRate agregada a purchase_orders');
    }

    console.log('✅ Migración AddMultiCurrencyToPurchaseOrders completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "exchangeRate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "purchaseCurrencyAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "purchaseCurrency"`,
    );
    console.log('✅ Rollback AddMultiCurrencyToPurchaseOrders completado');
  }
}
