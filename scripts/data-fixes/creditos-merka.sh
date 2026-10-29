#!/usr/bin/env bash
# SOLO LEE (modo solo-lectura): créditos (fiados) de Mercaexpress.
set -e
cd "$(dirname "$0")/../.."
URL="$(grep -E '^#? *external_host=' .env | head -1 | sed -E 's/^#? *external_host=//')"
[ -n "$URL" ] || { echo "No encontré external_host en el .env"; exit 1; }
PGOPTIONS='-c default_transaction_read_only=on -c timezone=America/Bogota' PGCONNECT_TIMEOUT=15 \
  psql "$URL" -X -P pager=off <<'SQL'
\echo '== 1) Usuarios del negocio'
SELECT u.email, u.role, u.status, u."lastLoginAt" AS ultimo_login
FROM users u WHERE u.organization_id = '8c5a2625-bdcf-4250-bc22-8c57f378273b' ORDER BY u.role;

\echo '== 2) Facturas a crédito o con saldo (14 días) y si tienen su crédito'
SELECT i.number, i.created_at AS llego, i."paymentMethod" AS pago, i.status, i.total, i."balanceDue" AS saldo,
       coalesce(c."companyName", c."firstName"||' '||c."lastName") AS cliente, u.email AS hizo,
       (SELECT count(*) FROM customer_credits cc WHERE cc.invoice_id = i.id AND cc.deleted_at IS NULL) AS creditos
FROM invoices i
LEFT JOIN customers c ON c.id = i."customerId"
LEFT JOIN users u ON u.id = i."createdById"
WHERE i.organization_id = '8c5a2625-bdcf-4250-bc22-8c57f378273b'
  AND i.created_at > now() - interval '14 days' AND i.deleted_at IS NULL
  AND (i."paymentMethod" = 'credit' OR i."balanceDue" > 0)
ORDER BY i.created_at DESC LIMIT 60;

\echo '== 3) Créditos creados por día y por usuario (14 días)'
SELECT date_trunc('day', cc.created_at)::date AS dia, u.email AS hizo,
       count(*) AS creditos, count(cc.invoice_id) AS de_factura, sum(cc.original_amount) AS total
FROM customer_credits cc LEFT JOIN users u ON u.id = cc.created_by_id
WHERE cc.organization_id = '8c5a2625-bdcf-4250-bc22-8c57f378273b'
  AND cc.created_at > now() - interval '14 days' AND cc.deleted_at IS NULL
GROUP BY 1,2 ORDER BY 1 DESC;

\echo '== 4) Abonos a créditos (14 días)'
SELECT date_trunc('day', p.created_at)::date AS dia, count(*) AS abonos, sum(p.amount) AS total
FROM credit_payments p JOIN customer_credits cc ON cc.id = p.credit_id
WHERE cc.organization_id = '8c5a2625-bdcf-4250-bc22-8c57f378273b'
  AND p.created_at > now() - interval '14 days'
GROUP BY 1 ORDER BY 1 DESC;
SQL
