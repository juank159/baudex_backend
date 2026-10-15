import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El POS no maneja impuestos: un producto solo lleva IVA si se configura
 * explícitamente como gravado. Las columnas tenían IVA 19% por defecto, así
 * que cualquier producto creado sin indicar el impuesto quedaba gravado y sus
 * ventas se partían en "venta + IVA" (la ganancia salía más baja de lo real).
 *
 * Solo cambia los valores por defecto de las columnas: no modifica datos.
 */
export class NoTaxByDefault1779200000000 implements MigrationInterface {
  name = 'NoTaxByDefault1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "tax_category" SET DEFAULT 'NO_GRAVADO'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "tax_rate" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "is_taxable" SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_notes" ALTER COLUMN "tax_percentage" SET DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "tax_category" SET DEFAULT 'IVA'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "tax_rate" SET DEFAULT 19`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "is_taxable" SET DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_notes" ALTER COLUMN "tax_percentage" SET DEFAULT 19`,
    );
  }
}
