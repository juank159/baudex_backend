import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soporte para la descarga incremental de la app (GET /sync/changes/:entity).
 *
 * La app descarga solo lo que cambió desde su última descarga, usando
 * `updated_at`. Para que eso sea confiable, esta migración garantiza en la
 * propia base de datos que:
 *
 * 1. Toda modificación de una fila sincronizable mueve su `updated_at`
 *    (aunque venga de SQL directo, un script de corrección o un borrado
 *    suave), con la hora del servidor.
 * 2. Un cambio en una tabla hija mueve el `updated_at` de su registro
 *    principal: ítems y pagos → factura, precios → producto, ítems → orden
 *    de compra / nota de crédito. La app descarga esos registros con sus
 *    hijos incluidos, así que deben volver a bajar.
 * 3. Un borrado definitivo (DELETE) de una fila sincronizable queda anotado
 *    en `sync_deletions`, para que la app también la quite.
 * 4. Índices por (organización, updated_at, id) para que la consulta de
 *    cambios no recorra la tabla completa.
 *
 * Solo agrega funciones, triggers, una tabla e índices: no modifica datos.
 */
export class IncrementalSyncSupport1779100000000 implements MigrationInterface {
  name = 'IncrementalSyncSupport1779100000000';

  /** Tablas que la app descarga, con su columna de organización. */
  private readonly syncedTables: Array<{ table: string; orgExpr: string }> = [
    { table: 'invoices', orgExpr: 'OLD.organization_id' },
    { table: 'products', orgExpr: 'OLD.organization_id' },
    {
      table: 'product_presentations',
      orgExpr:
        '(SELECT p.organization_id FROM products p WHERE p.id = OLD.product_id)',
    },
    { table: 'customers', orgExpr: 'OLD.organization_id' },
    { table: 'suppliers', orgExpr: 'OLD.organization_id' },
    { table: 'expenses', orgExpr: 'OLD.organization_id' },
    { table: 'purchase_orders', orgExpr: 'OLD.organization_id' },
    { table: 'credit_notes', orgExpr: 'OLD.organization_id' },
    { table: 'customer_credits', orgExpr: 'OLD.organization_id' },
    { table: 'inventory_batches', orgExpr: 'OLD.organization_id' },
    { table: 'inventory_movements', orgExpr: 'OLD.organization_id' },
    { table: 'notifications', orgExpr: 'OLD.organization_id' },
  ];

  /** Tablas hijas cuyo cambio debe "tocar" a su registro principal. */
  private readonly childTables: Array<{
    child: string;
    fk: string;
    parent: string;
  }> = [
    { child: 'invoice_items', fk: '"invoiceId"', parent: 'invoices' },
    { child: 'payments', fk: '"invoiceId"', parent: 'invoices' },
    { child: 'product_prices', fk: 'product_id', parent: 'products' },
    {
      child: 'purchase_order_items',
      fk: '"purchaseOrderId"',
      parent: 'purchase_orders',
    },
    { child: 'credit_note_items', fk: 'credit_note_id', parent: 'credit_notes' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear triggers e índices bloquea cada tabla un instante. Si una
    // operación larga la tiene ocupada, mejor fallar (y reintentar en el
    // siguiente arranque) que quedarse esperando y frenar las ventas.
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    // ── Registro de borrados definitivos ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_deletions" (
        "id" bigserial PRIMARY KEY,
        "table_name" varchar(64) NOT NULL,
        "row_id" uuid NOT NULL,
        "organization_id" uuid NULL,
        "deleted_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sync_deletions_lookup"
      ON "sync_deletions" ("organization_id", "table_name", "deleted_at")
    `);

    // ── 1. updated_at siempre al día ─────────────────────────────────────
    // Sin comparar la fila vieja con la nueva: varias tablas tienen columnas
    // `json`, que Postgres no sabe comparar (`NEW IS DISTINCT FROM OLD`
    // fallaría y tumbaría la actualización). Un UPDATE que no cambie nada
    // solo hace que la fila se vuelva a descargar, lo cual es inofensivo.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // ── 3. Anotar borrados definitivos ───────────────────────────────────
    for (const { table, orgExpr } of this.syncedTables) {
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION sync_record_deletion_${table}() RETURNS trigger AS $$
        BEGIN
          INSERT INTO sync_deletions (table_name, row_id, organization_id)
          VALUES ('${table}', OLD.id, ${orgExpr});
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql
      `);
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS trg_sync_updated_at ON "${table}"`,
      );
      await queryRunner.query(`
        CREATE TRIGGER trg_sync_updated_at
        BEFORE UPDATE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION sync_set_updated_at()
      `);
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS trg_sync_record_deletion ON "${table}"`,
      );
      await queryRunner.query(`
        CREATE TRIGGER trg_sync_record_deletion
        AFTER DELETE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION sync_record_deletion_${table}()
      `);
    }

    // ── 2. Cambios en tablas hijas tocan al registro principal ───────────
    // `updated_at < now()` evita reescribir el principal varias veces en la
    // misma transacción (p. ej. una factura con 30 ítems): después del
    // primer toque ya vale now() y los siguientes no escriben nada.
    for (const { child, fk, parent } of this.childTables) {
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION sync_touch_parent_${child}() RETURNS trigger AS $$
        BEGIN
          IF TG_OP IN ('UPDATE', 'DELETE') THEN
            UPDATE "${parent}" SET updated_at = now()
            WHERE id = OLD.${fk} AND updated_at < now();
          END IF;
          IF TG_OP IN ('INSERT', 'UPDATE') THEN
            UPDATE "${parent}" SET updated_at = now()
            WHERE id = NEW.${fk} AND updated_at < now();
          END IF;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql
      `);
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS trg_sync_touch_parent ON "${child}"`,
      );
      await queryRunner.query(`
        CREATE TRIGGER trg_sync_touch_parent
        AFTER INSERT OR UPDATE OR DELETE ON "${child}"
        FOR EACH ROW EXECUTE FUNCTION sync_touch_parent_${child}()
      `);
    }

    // ── 4. Índices para la consulta de cambios ───────────────────────────
    for (const { table } of this.syncedTables) {
      if (table === 'product_presentations') continue;
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${table}_sync_cursor"
        ON "${table}" ("organization_id", "updated_at", "id")
      `);
    }
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_presentations_sync_cursor"
      ON "product_presentations" ("updated_at", "id")
    `);

    console.log('Migración IncrementalSyncSupport completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { child } of this.childTables) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS trg_sync_touch_parent ON "${child}"`,
      );
      await queryRunner.query(
        `DROP FUNCTION IF EXISTS sync_touch_parent_${child}()`,
      );
    }
    for (const { table } of this.syncedTables) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS trg_sync_updated_at ON "${table}"`,
      );
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS trg_sync_record_deletion ON "${table}"`,
      );
      await queryRunner.query(
        `DROP FUNCTION IF EXISTS sync_record_deletion_${table}()`,
      );
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_sync_cursor"`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_set_updated_at()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_deletions"`);
  }
}
