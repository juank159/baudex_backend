// src/database/migrations/1733350000000-AddBalanceGeneratedToTransactionEnum.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBalanceGeneratedToTransactionEnum1733350000000 implements MigrationInterface {
  name = 'AddBalanceGeneratedToTransactionEnum1733350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si el enum existe (puede no existir aún si CreateCreditTransactionsTable no ha corrido)
    const enumExists = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_transaction_type_enum')
    `);
    if (!enumExists[0].exists) {
      console.log('⏭️ Enum credit_transaction_type_enum no existe aún, se configurará en CreateCreditTransactionsTable');
      return;
    }

    // Agregar nuevo valor 'balance_generated' al enum credit_transaction_type_enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'balance_generated'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'credit_transaction_type_enum')
        ) THEN
          ALTER TYPE "credit_transaction_type_enum" ADD VALUE 'balance_generated';
        END IF;
      END$$;
    `);

    console.log('✅ Valor balance_generated agregado al enum credit_transaction_type_enum');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOTA: PostgreSQL no permite eliminar valores de un enum directamente.
    // Para revertir esto, se necesitaría:
    // 1. Crear un nuevo enum sin el valor
    // 2. Actualizar todas las columnas que usan el enum
    // 3. Eliminar el enum antiguo
    // 4. Renombrar el nuevo enum
    //
    // Como esto es complejo y riesgoso, solo mostramos un mensaje de advertencia.
    console.log('⚠️ ADVERTENCIA: No se puede eliminar el valor balance_generated del enum automáticamente.');
    console.log('⚠️ Si necesita revertir este cambio, debe hacerlo manualmente en la base de datos.');
  }
}
