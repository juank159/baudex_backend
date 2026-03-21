import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FIX CRITICAL BUG: TypeORM returns decimal columns as strings.
 * The + operator in JavaScript concatenates strings instead of adding numbers.
 *
 * Example of the bug:
 *   subtotal + taxAmount + shippingCost
 *   12114300 + 0 + "0.00"     ← shippingCost was string "0.00" (truthy)
 *   = "121143000.00"          ← STRING CONCATENATION, not addition!
 *
 * This migration recalculates ALL purchase order item and header totals
 * from the raw quantity * unitCost values to fix any corrupted data.
 */
export class RecalculatePurchaseOrderTotals1764700000000
  implements MigrationInterface
{
  name = 'RecalculatePurchaseOrderTotals1764700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Recalculate item-level totals from quantity * unitCost
    await queryRunner.query(`
      UPDATE purchase_order_items
      SET
        subtotal = quantity * "unitCost",
        "taxAmount" = CASE
          WHEN COALESCE("taxPercentage", 0) > 0
          THEN ROUND(quantity * "unitCost" * "taxPercentage" / 100, 2)
          ELSE 0
        END,
        total = quantity * "unitCost" +
          CASE
            WHEN COALESCE("taxPercentage", 0) > 0
            THEN ROUND(quantity * "unitCost" * "taxPercentage" / 100, 2)
            ELSE 0
          END
    `);

    // Step 2: Recalculate PO header totals from corrected items
    await queryRunner.query(`
      UPDATE purchase_orders po
      SET
        subtotal = COALESCE(item_calc.sum_subtotal, 0),
        "taxAmount" = CASE
          WHEN COALESCE(po."taxPercentage", 0) > 0
          THEN ROUND(COALESCE(item_calc.sum_subtotal, 0) * po."taxPercentage" / 100, 2)
          ELSE 0
        END,
        total = COALESCE(item_calc.sum_subtotal, 0) +
          CASE
            WHEN COALESCE(po."taxPercentage", 0) > 0
            THEN ROUND(COALESCE(item_calc.sum_subtotal, 0) * po."taxPercentage" / 100, 2)
            ELSE 0
          END +
          COALESCE(po."shippingCost", 0)
      FROM (
        SELECT "purchaseOrderId", SUM(quantity * "unitCost") as sum_subtotal
        FROM purchase_order_items
        GROUP BY "purchaseOrderId"
      ) item_calc
      WHERE po.id = item_calc."purchaseOrderId"
    `);

    // Step 3: Handle POs with no items (set totals to 0)
    await queryRunner.query(`
      UPDATE purchase_orders po
      SET subtotal = 0, "taxAmount" = 0, total = 0
      WHERE NOT EXISTS (
        SELECT 1 FROM purchase_order_items WHERE "purchaseOrderId" = po.id
      )
      AND (po.subtotal != 0 OR po.total != 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot revert to corrupted data - this is a data fix migration
    // The corrected totals are the correct values
  }
}
