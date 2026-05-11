import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3a — Integra presentaciones de venta en facturación.
 *
 * Agrega 2 columnas opcionales a `invoice_items`:
 *   - presentation_id     → FK a product_presentations (nullable)
 *   - presentation_factor → snapshot del factor al momento de la venta
 *                           (preserva integridad histórica si la presentación
 *                           cambia su factor más adelante)
 *
 * Ningún valor por defecto: facturas existentes y nuevas que no usen
 * presentaciones siguen funcionando exactamente igual (factor implícito = 1
 * vía el getter `baseQuantity` en la entidad). Idempotente.
 */
export class AddPresentationToInvoiceItems1777100000000
  implements MigrationInterface
{
  name = 'AddPresentationToInvoiceItems1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const presentationIdExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoice_items' AND column_name = 'presentation_id'
    `);
    if (presentationIdExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "invoice_items" ADD COLUMN "presentation_id" uuid NULL`,
      );
      await queryRunner.query(`
        ALTER TABLE "invoice_items"
        ADD CONSTRAINT "FK_invoice_items_presentation"
        FOREIGN KEY ("presentation_id")
        REFERENCES "product_presentations"("id")
        ON DELETE SET NULL
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_invoice_items_presentation_id" ON "invoice_items" ("presentation_id")`,
      );
      console.log('✅ presentation_id agregada a invoice_items');
    }

    const presentationFactorExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoice_items' AND column_name = 'presentation_factor'
    `);
    if (presentationFactorExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "invoice_items" ADD COLUMN "presentation_factor" decimal(14,4) NULL`,
      );
      console.log('✅ presentation_factor agregada a invoice_items');
    }

    console.log('✅ Migración AddPresentationToInvoiceItems completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP COLUMN IF EXISTS "presentation_factor"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_invoice_items_presentation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "FK_invoice_items_presentation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP COLUMN IF EXISTS "presentation_id"`,
    );
    console.log('✅ Rollback AddPresentationToInvoiceItems completado');
  }
}
