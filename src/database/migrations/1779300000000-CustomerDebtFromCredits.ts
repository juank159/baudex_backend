import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La deuda del cliente (`customers."currentBalance"` y `customers.credit_balance`)
 * se calcula desde sus créditos reales, en la propia base de datos.
 *
 * Antes se sumaba y restaba en cada operación, por caminos distintos y cada
 * uno sobre un campo distinto: crear factura sumaba a `currentBalance`, crear
 * crédito sumaba a `credit_balance`, un abono recalculaba ambos, un pago
 * desde la factura restaba solo uno... Con los meses los contadores quedaron
 * desfasados (en Mercaexpress, 76 de 104 clientes mostraban una "deuda
 * actual" distinta a la suma de sus créditos pendientes).
 *
 * 1. Trigger en `customer_credits`: cada vez que un crédito se crea, cambia
 *    o se borra, la deuda de su cliente se recalcula como la suma de
 *    `balance_due` de sus créditos activos, dentro de la misma transacción.
 *    El trigger de `customers` mueve `updated_at`, así que la app vuelve a
 *    descargar el cliente con la deuda correcta.
 * 2. Recalcula una vez la deuda de todos los clientes.
 *
 * Solo toca los dos contadores derivados; créditos, facturas y pagos no se
 * modifican.
 */
export class CustomerDebtFromCredits1779300000000 implements MigrationInterface {
  name = 'CustomerDebtFromCredits1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION baudex_recalc_customer_debt(p_customer_id uuid)
      RETURNS void LANGUAGE plpgsql AS $$
      DECLARE
        v_total numeric(12,2);
      BEGIN
        IF p_customer_id IS NULL THEN
          RETURN;
        END IF;
        SELECT COALESCE(SUM(cc.balance_due), 0) INTO v_total
          FROM customer_credits cc
         WHERE cc.customer_id = p_customer_id
           AND cc.deleted_at IS NULL
           AND cc.status IN ('pending', 'partially_paid', 'overdue');
        UPDATE customers c
           SET credit_balance = v_total,
               "currentBalance" = v_total
         WHERE c.id = p_customer_id
           AND (c.credit_balance IS DISTINCT FROM v_total
                OR c."currentBalance" IS DISTINCT FROM v_total);
      END $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION baudex_customer_credits_recalc_debt()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
          PERFORM baudex_recalc_customer_debt(OLD.customer_id);
        END IF;
        IF TG_OP = 'INSERT'
           OR (TG_OP = 'UPDATE' AND NEW.customer_id IS DISTINCT FROM OLD.customer_id) THEN
          PERFORM baudex_recalc_customer_debt(NEW.customer_id);
        END IF;
        RETURN NULL;
      END $$
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_customer_credits_recalc_debt ON customer_credits`,
    );
    await queryRunner.query(`
      CREATE TRIGGER trg_customer_credits_recalc_debt
      AFTER INSERT OR UPDATE OR DELETE ON customer_credits
      FOR EACH ROW EXECUTE FUNCTION baudex_customer_credits_recalc_debt()
    `);

    // Corrección única: deuda de todos los clientes desde sus créditos.
    await queryRunner.query(`
      UPDATE customers c
         SET credit_balance = d.total,
             "currentBalance" = d.total
        FROM (
          SELECT cu.id,
                 COALESCE((
                   SELECT SUM(cc.balance_due)
                     FROM customer_credits cc
                    WHERE cc.customer_id = cu.id
                      AND cc.deleted_at IS NULL
                      AND cc.status IN ('pending', 'partially_paid', 'overdue')
                 ), 0)::numeric(12,2) AS total
            FROM customers cu
        ) d
       WHERE c.id = d.id
         AND (c.credit_balance IS DISTINCT FROM d.total
              OR c."currentBalance" IS DISTINCT FROM d.total)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_customer_credits_recalc_debt ON customer_credits`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS baudex_customer_credits_recalc_debt()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS baudex_recalc_customer_debt(uuid)`,
    );
  }
}
