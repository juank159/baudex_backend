#!/usr/bin/env bash
# SOLO LEE la base (modo solo-lectura): no cambia nada.
# 1) Cupo de crédito del Consumidor Final en cada negocio.
# 2) Estado de la factura de prueba INV-2026-455009 y sus notas crédito.
set -e
cd "$(dirname "$0")/../.."
# Conexión de producción: la línea "external_host=" del .env (puerto 5432).
URL="$(grep -E '^#? *external_host=' .env | head -1 | sed -E 's/^#? *external_host=//')"
[ -n "$URL" ] || { echo "No encontré external_host en el .env"; exit 1; }
PGOPTIONS='-c default_transaction_read_only=on' PGCONNECT_TIMEOUT=15 \
  psql "$URL" -X -P pager=off <<'SQL'
\echo '== 1) Consumidor Final (el cupo debe ser 0 en todos)'
SELECT o.name AS negocio, c."creditLimit" AS cupo, c."currentBalance" AS saldo
FROM customers c LEFT JOIN organizations o ON o.id = c.organization_id
WHERE c."documentNumber" = '222222222222' AND c.deleted_at IS NULL
ORDER BY 1;
\echo '== 2) Factura INV-2026-455009'
SELECT o.name AS negocio, i.number, i.status, i.total, i."paidAmount" AS pagado,
       i."balanceDue" AS saldo, i.credited_amount AS acreditado, i.deleted_at AS borrada
FROM invoices i LEFT JOIN organizations o ON o.id = i.organization_id
WHERE i.number = 'INV-2026-455009';
\echo '== 3) Notas crédito de esa factura'
SELECT cn.number, cn.status, cn.total, cn.created_at
FROM credit_notes cn JOIN invoices i ON i.id = cn.invoice_id
WHERE i.number = 'INV-2026-455009' AND cn.deleted_at IS NULL;
SQL
