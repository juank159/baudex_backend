import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncreaseSupplierCreditLimitPrecision1763874182000
  implements MigrationInterface
{
  name = 'IncreaseSupplierCreditLimitPrecision1763874182000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Aumentar la precisión de creditLimit de NUMERIC(5,2) a NUMERIC(15,2)
    // Esto permite valores desde -9,999,999,999,999.99 hasta 9,999,999,999,999.99
    await queryRunner.query(`
      ALTER TABLE "suppliers"
      ALTER COLUMN "creditLimit" TYPE NUMERIC(15,2)
    `);

    // Agregar comentario a la columna
    await queryRunner.query(`
      COMMENT ON COLUMN "suppliers"."creditLimit" IS 'Límite de crédito del proveedor en la moneda configurada (max: 9,999,999,999,999.99)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir al tamaño anterior (con precaución: puede causar pérdida de datos si existen valores grandes)
    await queryRunner.query(`
      ALTER TABLE "suppliers"
      ALTER COLUMN "creditLimit" TYPE NUMERIC(5,2)
    `);

    // Eliminar comentario
    await queryRunner.query(`
      COMMENT ON COLUMN "suppliers"."creditLimit" IS NULL
    `);
  }
}
