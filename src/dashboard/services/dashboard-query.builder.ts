import { toUtcAtTenantMidnight } from '../../common/utils/timezone-range.util';

/**
 * Queries SQL del dashboard, aisladas del service para facilitar testing y revisión.
 *
 * Reglas:
 * - Toda comparación con paymentDate usa rangos de timestamp (no ::date) para
 *   aprovechar el índice (organization_id, paymentDate).
 * - El rango local del usuario se convierte a timestamps UTC en JS (tz-aware).
 * - Ninguna query usa funciones en el WHERE sobre columnas indexadas.
 */

export class DashboardQueryBuilder {
  /** @deprecated Usar `toUtcAtTenantMidnight` del util compartido. */
  static toUtcRange(dateStr: string, orgTimezone: string): Date {
    return toUtcAtTenantMidnight(dateStr, orgTimezone);
  }

  // ───────── Invoices (facturadas) ─────────
  static invoiceAggregates(): string {
    return `
      SELECT
        COUNT(*)::int                                    AS total_invoices,
        COALESCE(SUM(CAST(total AS DECIMAL)), 0)::numeric AS total_billed,
        COALESCE(SUM(CAST("paidAmount" AS DECIMAL)), 0)::numeric AS total_paid_on_period_invoices,
        COUNT(*) FILTER (WHERE status = 'paid')::int     AS paid_invoices,
        COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending_invoices
      FROM invoices
      WHERE organization_id = $1
        AND deleted_at IS NULL
        AND date >= $2::date
        AND date <= $3::date
    `;
  }

  // ───────── Expenses aprobados ─────────
  static expenseAggregate(): string {
    return `
      SELECT
        COUNT(*)::int                                         AS total_count,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0)::numeric    AS total_amount
      FROM expenses
      WHERE organization_id = $1
        AND status IN ('approved', 'paid')
        AND deleted_at IS NULL
        AND date >= $2::date
        AND date <= $3::date
    `;
  }

  // ───────── Conteos globales (no filtran por rango) ─────────
  static productCount(): string {
    return `SELECT COUNT(*)::int AS total FROM products WHERE organization_id = $1 AND deleted_at IS NULL`;
  }

  static customerCount(): string {
    return `SELECT COUNT(*)::int AS total FROM customers WHERE organization_id = $1 AND deleted_at IS NULL`;
  }

  // ───────── Cobros del período (cash basis) ─────────
  // Usa rango timestamp + índice (organization_id, paymentDate).
  static totalCollected(): string {
    return `
      SELECT COALESCE(SUM(amount), 0)::numeric AS total_collected,
             COUNT(*)::int                      AS payment_count
      FROM payments
      WHERE organization_id = $1
        AND deleted_at IS NULL
        AND "paymentDate" >= $2
        AND "paymentDate" <  $3
    `;
  }

  // ───────── Abonos del período en facturas creadas fuera del período ─────────
  static paymentsOnOldInvoices(): string {
    return `
      SELECT COALESCE(SUM(p.amount), 0)::numeric AS payment_income
      FROM payments p
      INNER JOIN invoices i ON p."invoiceId" = i.id
      WHERE p.organization_id = $1
        AND p.deleted_at IS NULL
        AND i.deleted_at IS NULL
        AND p."paymentDate" >= $2
        AND p."paymentDate" <  $3
        AND (i.date < $4::date OR i.date > $5::date)
    `;
  }

  // ───────── Desglose por método de pago ─────────
  // Un pago entra al desglose si paymentDate ∈ [rango) O la factura está en el rango.
  static paymentMethodsBreakdown(): string {
    return `
      SELECT
        COALESCE(ba.name, p."paymentMethod") AS method,
        COUNT(p.id)::int                     AS count,
        SUM(p.amount)::numeric               AS total_amount
      FROM payments p
      INNER JOIN invoices i ON p."invoiceId" = i.id
      LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
      WHERE p.organization_id = $1
        AND p.deleted_at IS NULL
        AND i.deleted_at IS NULL
        AND (
          (p."paymentDate" >= $2 AND p."paymentDate" < $3)
          OR (i.date >= $4::date AND i.date <= $5::date)
        )
      GROUP BY COALESCE(ba.name, p."paymentMethod")
      ORDER BY total_amount DESC
    `;
  }

  // ───────── Desglose por moneda ─────────
  static currencyBreakdown(): string {
    return `
      SELECT
        COALESCE(p."paymentCurrency", $2)                   AS currency,
        COUNT(p.id)::int                                     AS count,
        SUM(p.amount)::numeric                               AS total_base_amount,
        SUM(COALESCE(p."paymentCurrencyAmount", p.amount))::numeric AS total_foreign_amount,
        AVG(COALESCE(p."exchangeRate", 1))::numeric          AS avg_rate
      FROM payments p
      INNER JOIN invoices i ON p."invoiceId" = i.id
      WHERE p.organization_id = $1
        AND p.deleted_at IS NULL
        AND i.deleted_at IS NULL
        AND (
          (p."paymentDate" >= $3 AND p."paymentDate" < $4)
          OR (i.date >= $5::date AND i.date <= $6::date)
        )
      GROUP BY COALESCE(p."paymentCurrency", $2)
      ORDER BY total_base_amount DESC
    `;
  }

  // ───────── Saldos a favor aplicados en facturas del período ─────────
  static creditsApplied(): string {
    return `
      SELECT COALESCE(SUM(client_balance_applied), 0)::numeric AS total
      FROM invoices
      WHERE organization_id = $1
        AND deleted_at IS NULL
        AND client_balance_applied > 0
        AND date >= $2::date
        AND date <= $3::date
    `;
  }

  // ───────── Notas de crédito CONFIRMADAS (=aplicadas) en el período ─────────
  // El enum solo tiene draft/confirmed/cancelled — cuando se confirma se
  // aplica simultáneamente al balance del cliente / factura. Por eso
  // `status='confirmed'` ES la NC efectiva (no existe un 'applied' aparte).
  // Usamos applied_at::date en TZ del tenant cuando existe; si no, fallback
  // a date (fecha de emisión) para no perder NCs viejas que se confirmaron
  // antes de que el campo applied_at fuera populado.
  static creditNotesApplied(): string {
    return `
      SELECT
        COALESCE(SUM(total), 0)::numeric AS total,
        COUNT(*)::int                    AS count
      FROM credit_notes
      WHERE organization_id = $1
        AND deleted_at IS NULL
        AND status = 'confirmed'
        AND (
          (applied_at IS NOT NULL
            AND (applied_at AT TIME ZONE $4)::date >= $2::date
            AND (applied_at AT TIME ZONE $4)::date <= $3::date)
          OR
          (applied_at IS NULL
            AND (date AT TIME ZONE $4)::date >= $2::date
            AND (date AT TIME ZONE $4)::date <= $3::date)
        )
    `;
  }

  // ───────── Receivables (cartera global con semáforo) ─────────
  // Calcula urgencia usando (NOW AT TIME ZONE orgTz)::date vs dueDate::date.
  static receivablesByUrgency(): string {
    return `
      WITH pending AS (
        SELECT
          i."balanceDue"::numeric                                          AS balance_due,
          i."dueDate",
          CASE
            WHEN i."dueDate" IS NULL THEN 'current'
            WHEN i."dueDate"::date < (NOW() AT TIME ZONE $2)::date THEN 'overdue'
            WHEN i."dueDate"::date <= (NOW() AT TIME ZONE $2)::date + INTERVAL '7 days' THEN 'dueSoon'
            ELSE 'current'
          END AS urgency,
          CASE
            WHEN i."dueDate" IS NULL THEN 0
            ELSE GREATEST(0, (NOW() AT TIME ZONE $2)::date - i."dueDate"::date)
          END AS days_overdue
        FROM invoices i
        WHERE i.organization_id = $1
          AND i.status IN ('pending', 'partially_paid')
          AND i."balanceDue" > 0
          AND i.deleted_at IS NULL
      )
      SELECT urgency,
             COUNT(*)::int                          AS count,
             COALESCE(SUM(balance_due), 0)::numeric AS total,
             COALESCE(MAX(days_overdue), 0)::int    AS max_days_overdue
      FROM pending
      GROUP BY urgency
    `;
  }

  static topDebtors(): string {
    return `
      SELECT
        c.id                                                                                   AS customer_id,
        COALESCE(NULLIF(TRIM(CONCAT(c."firstName", ' ', c."lastName")), ''), c."companyName", 'Sin nombre') AS customer_name,
        COUNT(i.id)::int                                                                       AS invoice_count,
        COALESCE(SUM(i."balanceDue"::numeric), 0)::numeric                                    AS total_balance,
        COALESCE(MAX(GREATEST(0, (NOW() AT TIME ZONE $2)::date - i."dueDate"::date)), 0)::int AS max_days_overdue
      FROM invoices i
      INNER JOIN customers c ON i."customerId" = c.id
      WHERE i.organization_id = $1
        AND i.status IN ('pending', 'partially_paid')
        AND i."balanceDue" > 0
        AND i.deleted_at IS NULL
      GROUP BY c.id, c."firstName", c."lastName", c."companyName"
      ORDER BY total_balance DESC
      LIMIT 3
    `;
  }

  // ───────── Tendencia real por día dentro del rango ─────────
  // Devuelve una fila por cada día del rango (incluye días sin actividad con ceros).
  static trendByDay(): string {
    return `
      WITH days AS (
        SELECT generate_series($2::date, $3::date, '1 day')::date AS day
      ),
      daily_collected AS (
        SELECT (p."paymentDate" AT TIME ZONE $4)::date AS day,
               SUM(p.amount)::numeric AS revenue
        FROM payments p
        WHERE p.organization_id = $1
          AND p.deleted_at IS NULL
          AND p."paymentDate" >= $5
          AND p."paymentDate" <  $6
        GROUP BY (p."paymentDate" AT TIME ZONE $4)::date
      ),
      daily_billed AS (
        SELECT i.date AS day,
               SUM(i.total::numeric) AS billed
        FROM invoices i
        WHERE i.organization_id = $1
          AND i.deleted_at IS NULL
          AND i.date BETWEEN $2::date AND $3::date
        GROUP BY i.date
      ),
      daily_expenses AS (
        SELECT e.date AS day,
               SUM(e.amount::numeric) AS expenses
        FROM expenses e
        WHERE e.organization_id = $1
          AND e.status = 'approved'
          AND e.deleted_at IS NULL
          AND e.date BETWEEN $2::date AND $3::date
        GROUP BY e.date
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD')               AS date,
        COALESCE(dc.revenue, 0)::numeric           AS revenue,
        COALESCE(db.billed, 0)::numeric            AS billed,
        COALESCE(de.expenses, 0)::numeric          AS expenses
      FROM days d
      LEFT JOIN daily_collected dc ON dc.day = d.day
      LEFT JOIN daily_billed    db ON db.day = d.day
      LEFT JOIN daily_expenses  de ON de.day = d.day
      ORDER BY d.day
    `;
  }

  // ───────── Abonos a préstamos directos (créditos sin factura) ─────────
  // Cobros del período sobre créditos donde customer_credits.invoice_id IS NULL
  // (el usuario les dice "créditos directos" o "préstamos").
  // NO son ventas nuevas, son recuperación de cartera.
  static directLoanPayments(): string {
    return `
      SELECT COALESCE(SUM(cp.amount), 0)::numeric AS total,
             COUNT(cp.id)::int                    AS count
      FROM credit_payments cp
      INNER JOIN customer_credits cc ON cp.credit_id = cc.id
      WHERE cp.organization_id = $1
        AND cp.deleted_at IS NULL
        AND cc.deleted_at IS NULL
        AND cc.invoice_id IS NULL
        AND cp.payment_date >= $2
        AND cp.payment_date <  $3
    `;
  }

  // ───────── Desglose de abonos a préstamos por cuenta/método ─────────
  // Mismo filtro que directLoanPayments, pero agrupado. Útil para saber
  // "los 200K de préstamos, ¿en qué cuenta/medio se recibieron?".
  static directLoanPaymentsByMethod(): string {
    return `
      SELECT
        COALESCE(ba.name, cp.payment_method, 'Sin especificar') AS method,
        COUNT(cp.id)::int                                       AS count,
        SUM(cp.amount)::numeric                                 AS total
      FROM credit_payments cp
      INNER JOIN customer_credits cc ON cp.credit_id = cc.id
      LEFT JOIN bank_accounts ba ON cp.bank_account_id = ba.id
      WHERE cp.organization_id = $1
        AND cp.deleted_at IS NULL
        AND cc.deleted_at IS NULL
        AND cc.invoice_id IS NULL
        AND cp.payment_date >= $2
        AND cp.payment_date <  $3
      GROUP BY COALESCE(ba.name, cp.payment_method, 'Sin especificar')
      ORDER BY total DESC
    `;
  }

  // ───────── Depósitos a saldo a favor del cliente (anticipos) ─────────
  // Movimientos de client_balance_transactions tipo 'deposit' en el período.
  // NO son ingresos (son pasivos: se le debe al cliente), pero SÍ son caja.
  static customerDeposits(): string {
    return `
      SELECT COALESCE(SUM(bt.amount), 0)::numeric AS total,
             COUNT(bt.id)::int                    AS count
      FROM client_balance_transactions bt
      WHERE bt.organization_id = $1
        AND bt.type = 'deposit'
        AND bt.created_at >= $2
        AND bt.created_at <  $3
    `;
  }

  // ───────── Desglose de COMPRAS por moneda ─────────
  // Análogo a currencyBreakdown() pero sobre purchase_orders. Solo considera
  // órdenes con status no cancelado dentro del rango local del usuario.
  // Usa orderDate (timestamptz) con rango UTC precalculado — índice
  // (organization_id, orderDate).
  //
  // Params: $1 organizationId, $2 baseCurrency, $3 startUtc, $4 endUtcExclusive
  static purchaseCurrencyBreakdown(): string {
    return `
      SELECT
        COALESCE(po."purchaseCurrency", $2)                         AS currency,
        COUNT(po.id)::int                                           AS count,
        SUM(po.total)::numeric                                      AS total_base_amount,
        SUM(COALESCE(po."purchaseCurrencyAmount", po.total))::numeric AS total_foreign_amount,
        AVG(COALESCE(po."exchangeRate", 1))::numeric                AS avg_rate
      FROM purchase_orders po
      WHERE po.organization_id = $1
        AND po.deleted_at IS NULL
        AND po.status <> 'cancelled'
        AND po."date" >= $3
        AND po."date" <  $4
      GROUP BY COALESCE(po."purchaseCurrency", $2)
      ORDER BY total_base_amount DESC
    `;
  }

  // ───────── Desglose de anticipos por método ─────────
  // client_balance_transactions no tiene bank_account_id, solo paymentMethod.
  static customerDepositsByMethod(): string {
    return `
      SELECT
        COALESCE(bt.payment_method, 'Sin especificar') AS method,
        COUNT(bt.id)::int                              AS count,
        SUM(bt.amount)::numeric                        AS total
      FROM client_balance_transactions bt
      WHERE bt.organization_id = $1
        AND bt.type = 'deposit'
        AND bt.created_at >= $2
        AND bt.created_at <  $3
      GROUP BY COALESCE(bt.payment_method, 'Sin especificar')
      ORDER BY total DESC
    `;
  }

  // ───────── Período anterior (mismo rango de días desplazado hacia atrás) ─────────
  static previousPeriodRevenue(): string {
    return `
      SELECT COALESCE(SUM(p.amount), 0)::numeric AS total
      FROM payments p
      WHERE p.organization_id = $1
        AND p.deleted_at IS NULL
        AND p."paymentDate" >= $2
        AND p."paymentDate" <  $3
    `;
  }
}
