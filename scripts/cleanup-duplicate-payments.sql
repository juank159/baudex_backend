-- ============================================================================
-- LIMPIEZA DE PAGOS DUPLICADOS EN INVOICES
-- ============================================================================
--
-- Contexto: Antes del fix de idempotencia, el sync offline podía crear pagos
-- duplicados en la tabla `payments` al reintentar operaciones. Esto inflaba
-- `totalRevenue` en /dashboard/summary.
--
-- Este script:
--   1) PREVIEW: muestra los duplicados candidatos (ejecutar primero, sin commit)
--   2) SOFT-DELETE: marca con deleted_at los duplicados, conservando el más antiguo
--   3) RECALCULA invoice.paidAmount, balanceDue y status según los pagos vivos
--
-- Criterio de duplicado:
--   mismo (organization_id, invoice_id, amount, payment_method, bank_account_id)
--   creados en ventanas de <= 5 minutos (created_at similar)
--   ambos con deleted_at IS NULL
--
-- IMPORTANTE:
--   - Ejecutar dentro de una transacción con ROLLBACK primero para revisar.
--   - Respaldar DB antes de aplicar el COMMIT final.
--   - El script respeta tenant_isolation operando siempre con organization_id.
-- ============================================================================

BEGIN;

-- ========== 1) PREVIEW: duplicados candidatos ==========
-- Muestra grupos de pagos probablemente duplicados
-- Las filas con row_number > 1 son las que se eliminarán.
SELECT
  p.id,
  p.organization_id,
  p."invoiceId"     AS invoice_id,
  p."paymentNumber" AS payment_number,
  p.amount,
  p."paymentMethod" AS payment_method,
  p.bank_account_id,
  p."paymentDate"   AS payment_date,
  p.created_at,
  ROW_NUMBER() OVER (
    PARTITION BY
      p.organization_id,
      p."invoiceId",
      p.amount,
      p."paymentMethod",
      COALESCE(p.bank_account_id::text, 'null'),
      -- Agrupa pagos creados dentro de la misma ventana de 5 minutos
      date_trunc('minute', p.created_at) - (EXTRACT(MINUTE FROM p.created_at)::int % 5) * INTERVAL '1 minute'
    ORDER BY p.created_at ASC, p.id ASC
  ) AS rn
FROM payments p
WHERE p.deleted_at IS NULL
ORDER BY p.organization_id, p."invoiceId", p.created_at;

-- ========== 2) SOFT-DELETE: marcar duplicados ==========
-- Conserva SIEMPRE el pago más antiguo (rn = 1) de cada grupo.
WITH candidates AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        p.organization_id,
        p."invoiceId",
        p.amount,
        p."paymentMethod",
        COALESCE(p.bank_account_id::text, 'null'),
        date_trunc('minute', p.created_at) - (EXTRACT(MINUTE FROM p.created_at)::int % 5) * INTERVAL '1 minute'
      ORDER BY p.created_at ASC, p.id ASC
    ) AS rn
  FROM payments p
  WHERE p.deleted_at IS NULL
)
UPDATE payments SET
  deleted_at = NOW(),
  updated_at = NOW(),
  notes = COALESCE(notes, '') || ' [auto-deleted as duplicate by cleanup-duplicate-payments.sql]'
WHERE id IN (SELECT id FROM candidates WHERE rn > 1);

-- Reporta cuántas filas fueron marcadas
-- (El cliente psql imprime "UPDATE N" automáticamente)

-- ========== 3) RECALCULAR totales de invoices afectadas ==========
-- Las facturas cuyos pagos fueron reducidos deben tener paidAmount/balanceDue
-- actualizados y el status ajustado.
WITH affected_invoices AS (
  SELECT DISTINCT "invoiceId" AS invoice_id
  FROM payments
  WHERE deleted_at >= NOW() - INTERVAL '1 minute'  -- solo las marcadas ahora
),
sums AS (
  SELECT
    p."invoiceId" AS invoice_id,
    COALESCE(SUM(p.amount), 0) AS paid_sum
  FROM payments p
  WHERE p."invoiceId" IN (SELECT invoice_id FROM affected_invoices)
    AND p.deleted_at IS NULL
  GROUP BY p."invoiceId"
)
UPDATE invoices i SET
  "paidAmount" = s.paid_sum,
  "balanceDue" = GREATEST(0, i.total - s.paid_sum),
  status = CASE
    WHEN GREATEST(0, i.total - s.paid_sum) <= 0 THEN 'paid'::invoices_status_enum
    WHEN s.paid_sum > 0 THEN 'partially_paid'::invoices_status_enum
    ELSE 'pending'::invoices_status_enum
  END,
  updated_at = NOW()
FROM sums s
WHERE i.id = s.invoice_id;

-- ========== 4) VERIFICACIÓN ==========
-- Confirma que no queden duplicados candidatos
SELECT
  COUNT(*) AS remaining_duplicate_groups
FROM (
  SELECT 1
  FROM payments p
  WHERE p.deleted_at IS NULL
  GROUP BY
    p.organization_id,
    p."invoiceId",
    p.amount,
    p."paymentMethod",
    COALESCE(p.bank_account_id::text, 'null'),
    date_trunc('minute', p.created_at) - (EXTRACT(MINUTE FROM p.created_at)::int % 5) * INTERVAL '1 minute'
  HAVING COUNT(*) > 1
) q;

-- ============================================================================
-- REVISAR LOS RESULTADOS ANTES DE HACER COMMIT
-- Si todo se ve bien, cambiar "ROLLBACK" por "COMMIT"
-- ============================================================================

ROLLBACK;
-- COMMIT;
