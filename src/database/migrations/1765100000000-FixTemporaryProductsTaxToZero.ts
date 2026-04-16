import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración para corregir el IVA de productos temporales (sin registrar).
 *
 * Productos temporales NUNCA deben llevar IVA:
 * 1. Cambiar el DEFAULT de invoice_items.tax_percentage de 19 a 0
 * 2. Corregir items existentes con temporaryProductId que tienen tax_percentage != 0
 * 3. Recalcular subtotal de items temporales (sin extracción de IVA)
 * 4. Recalcular totales de facturas afectadas
 */
export class FixTemporaryProductsTaxToZero1765100000000
  implements MigrationInterface
{
  name = 'FixTemporaryProductsTaxToZero1765100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== 1. CAMBIAR DEFAULT DE LA COLUMNA ==========
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ALTER COLUMN "tax_percentage" SET DEFAULT 0
    `);
    console.log('✅ invoice_items.tax_percentage DEFAULT cambiado de 19 a 0');

    // ========== 2. CORREGIR ITEMS TEMPORALES EXISTENTES ==========
    const updateResult = await queryRunner.query(`
      UPDATE "invoice_items"
      SET "tax_percentage" = 0
      WHERE "temporaryProductId" IS NOT NULL
        AND "tax_percentage" != 0
    `);
    const affectedItems = updateResult?.[1] ?? 0;
    console.log(
      `✅ ${affectedItems} invoice_items de productos temporales corregidos a tax_percentage=0`,
    );

    // ========== 3. FIX ORPHANED FK + RECALCULAR SUBTOTALES ==========
    // Limpiar FKs huérfanas primero (temporaryProductId que no existe en temporary_products)
    await queryRunner.query(`
      UPDATE "invoice_items"
      SET "temporaryProductId" = NULL
      WHERE "temporaryProductId" IS NOT NULL
        AND "temporaryProductId" NOT IN (SELECT "id" FROM "temporary_products")
    `);
    console.log('✅ FKs huérfanas de temporaryProductId limpiadas');

    // Recalcular subtotales de items que ERAN temporales (tax_percentage = 0 y no tienen productId registrado)
    // Estos items tienen precio SIN IVA incluido, así que subtotal = qty * price - descuento
    await queryRunner.query(`
      UPDATE "invoice_items"
      SET "subtotal" = ROUND(
        (
          "quantity" * "unitPrice"
          - ("quantity" * "unitPrice" * COALESCE("discountPercentage", 0) / 100)
          - COALESCE("discountAmount", 0)
        )::numeric, 2
      )
      WHERE "tax_percentage" = 0
        AND "productId" IS NULL
    `);
    console.log('✅ Subtotales de items temporales recalculados');

    // ========== 4. RECALCULAR TOTALES DE FACTURAS AFECTADAS ==========
    // Facturas que tienen al menos un item sin productId (temporal)
    const affectedInvoices = await queryRunner.query(`
      SELECT DISTINCT ii."invoiceId" AS id
      FROM "invoice_items" ii
      WHERE ii."productId" IS NULL
    `);

    if (affectedInvoices.length > 0) {
      const invoiceIds = affectedInvoices
        .map((r: any) => `'${r.id}'`)
        .join(',');

      await queryRunner.query(`
        UPDATE "invoices" inv
        SET
          "subtotal" = calc."new_subtotal",
          "taxAmount" = calc."new_tax_amount",
          "taxPercentage" = CASE
            WHEN (calc."new_subtotal" - COALESCE(inv."discountAmount", 0)) > 0
            THEN ROUND((calc."new_tax_amount" / (calc."new_subtotal" - COALESCE(inv."discountAmount", 0)) * 100)::numeric, 2)
            ELSE 0
          END,
          "total" = ROUND(
            (calc."new_subtotal" - COALESCE(inv."discountAmount", 0) + calc."new_tax_amount")::numeric, 2
          ),
          "balanceDue" = ROUND(
            (calc."new_subtotal" - COALESCE(inv."discountAmount", 0) + calc."new_tax_amount" - COALESCE(inv."paidAmount", 0))::numeric, 2
          )
        FROM (
          SELECT
            ii."invoiceId" AS invoice_id,
            ROUND(SUM(ii."subtotal")::numeric, 2) AS "new_subtotal",
            ROUND(SUM(
              CASE
                WHEN ii."tax_percentage" > 0
                THEN ii."subtotal" * ii."tax_percentage" / 100
                ELSE 0
              END
            )::numeric, 2) AS "new_tax_amount"
          FROM "invoice_items" ii
          WHERE ii."invoiceId" IN (${invoiceIds})
          GROUP BY ii."invoiceId"
        ) calc
        WHERE inv."id" = calc.invoice_id
      `);

      console.log(
        `✅ ${affectedInvoices.length} facturas recalculadas`,
      );
    } else {
      console.log(
        'ℹ️ No hay facturas con productos temporales para recalcular',
      );
    }

    console.log('🎉 Migración completada: Productos temporales sin IVA');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ALTER COLUMN "tax_percentage" SET DEFAULT 19
    `);

    console.log(
      '⏪ Revertido: tax_percentage default vuelve a 19',
    );
  }
}
