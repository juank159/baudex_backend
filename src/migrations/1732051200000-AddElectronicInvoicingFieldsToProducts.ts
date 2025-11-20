import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddElectronicInvoicingFieldsToProducts1732051200000
  implements MigrationInterface
{
  name = 'AddElectronicInvoicingFieldsToProducts1732051200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tipo ENUM para tax_category
    await queryRunner.query(`
      CREATE TYPE "products_tax_category_enum" AS ENUM(
        'IVA',
        'INC',
        'INC_BOLSA',
        'EXENTO',
        'NO_GRAVADO'
      )
    `);

    // Crear tipo ENUM para retention_category
    await queryRunner.query(`
      CREATE TYPE "products_retention_category_enum" AS ENUM(
        'RET_IVA',
        'RET_RENTA',
        'RET_ICA',
        'RET_CREE'
      )
    `);

    // Agregar columnas de facturación electrónica a la tabla products
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "tax_category" "products_tax_category_enum" NOT NULL DEFAULT 'IVA',
      ADD COLUMN "tax_rate" NUMERIC(5,2) NOT NULL DEFAULT 19,
      ADD COLUMN "is_taxable" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN "tax_description" VARCHAR(200),
      ADD COLUMN "retention_category" "products_retention_category_enum",
      ADD COLUMN "retention_rate" NUMERIC(5,2) DEFAULT 0,
      ADD COLUMN "has_retention" BOOLEAN NOT NULL DEFAULT false
    `);

    // Agregar comentarios a las columnas
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."tax_category" IS 'Categoría de impuesto para facturación electrónica'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."tax_rate" IS 'Tasa de impuesto en porcentaje'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."is_taxable" IS 'Indica si el producto está gravado con impuestos'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."tax_description" IS 'Descripción del impuesto para la factura'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."retention_category" IS 'Categoría de retención en la fuente'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."retention_rate" IS 'Tasa de retención en porcentaje'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "products"."has_retention" IS 'Indica si el producto aplica retención en la fuente'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar columnas
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "has_retention",
      DROP COLUMN "retention_rate",
      DROP COLUMN "retention_category",
      DROP COLUMN "tax_description",
      DROP COLUMN "is_taxable",
      DROP COLUMN "tax_rate",
      DROP COLUMN "tax_category"
    `);

    // Eliminar tipos ENUM
    await queryRunner.query(`DROP TYPE "products_retention_category_enum"`);
    await queryRunner.query(`DROP TYPE "products_tax_category_enum"`);
  }
}
