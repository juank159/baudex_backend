import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPaymentDateColumnType1764980000000 implements MigrationInterface {
  name = 'FixPaymentDateColumnType1764980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // La columna paymentDate fue creada como "date" en la migración inicial,
    // pero la entidad Payment la declara como "timestamptz".
    // Esto causaba que AT TIME ZONE fallara en queries del dashboard.
    // Convertir a timestamptz para alinear con la entidad.
    const columns = await queryRunner.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'paymentDate'
    `);

    if (columns.length > 0 && columns[0].data_type === 'date') {
      await queryRunner.query(`
        ALTER TABLE "payments"
        ALTER COLUMN "paymentDate" TYPE timestamptz
        USING "paymentDate"::timestamptz
      `);
      console.log('✅ Columna paymentDate migrada de date a timestamptz');
    } else {
      console.log('⏭️ paymentDate ya es timestamptz o no existe, saltando');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ALTER COLUMN "paymentDate" TYPE date
      USING "paymentDate"::date
    `);
    console.log('✅ Columna paymentDate revertida a date');
  }
}
