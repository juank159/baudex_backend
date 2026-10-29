#!/usr/bin/env bash
# SOLO LEE: clientes Genesis Roso y Fany Cordoba de Mercaexpress (y sus créditos).
set -e
cd "$(dirname "$0")/../.."
URL="$(grep -E '^#? *external_host=' .env | head -1 | sed -E 's/^#? *external_host=//')"
[ -n "$URL" ] || { echo "No encontré external_host en el .env"; exit 1; }
PGOPTIONS='-c default_transaction_read_only=on -c timezone=America/Bogota' PGCONNECT_TIMEOUT=15 \
  psql "$URL" -X -P pager=off <<'SQL'
\echo '== 1) Clientes (incluye borrados)'
SELECT c.id, coalesce(c."companyName", c."firstName"||' '||c."lastName") AS cliente, c."documentNumber" AS documento,
       c.status, c."creditLimit" AS cupo, c.created_at AS creado, c.updated_at AS modificado, c.deleted_at AS borrado
FROM customers c
WHERE c.organization_id = '8c5a2625-bdcf-4250-bc22-8c57f378273b'
  AND (translate(lower(coalesce(c."firstName",'')||' '||coalesce(c."lastName",'')||' '||coalesce(c."companyName",'')),'áéíóúñ','aeiouñ') ~ '(genesis|fany|fanny|cordoba|roso|rozo)')
ORDER BY 2;

\echo '== 2) Sus créditos'
SELECT coalesce(c."companyName", c."firstName"||' '||c."lastName") AS cliente, i.number AS factura,
       cc.created_at AS creado, cc.original_amount AS valor, cc.paid_amount AS abonado, cc.balance_due AS debe,
       cc.status, u.email AS hizo, cc.updated_at AS modificado, cc.deleted_at AS borrado
FROM customer_credits cc
JOIN customers c ON c.id = cc.customer_id
LEFT JOIN invoices i ON i.id = cc.invoice_id
LEFT JOIN users u ON u.id = cc.created_by_id
WHERE cc.organization_id = '8c5a2625-bdcf-4250-bc22-8c57f378273b'
  AND (translate(lower(coalesce(c."firstName",'')||' '||coalesce(c."lastName",'')||' '||coalesce(c."companyName",'')),'áéíóúñ','aeiouñ') ~ '(genesis|fany|fanny|cordoba|roso|rozo)')
ORDER BY 1, cc.created_at DESC;

\echo '== 3) Sus abonos'
SELECT coalesce(c."companyName", c."firstName"||' '||c."lastName") AS cliente, p.created_at AS fecha, p.amount AS abono,
       p.payment_method AS medio, cc.balance_due AS credito_debe_ahora
FROM credit_payments p
JOIN customer_credits cc ON cc.id = p.credit_id
JOIN customers c ON c.id = cc.customer_id
WHERE cc.organization_id = '8c5a2625-bdcf-4250-bc22-8c57f378273b' AND p.deleted_at IS NULL
  AND (translate(lower(coalesce(c."firstName",'')||' '||coalesce(c."lastName",'')||' '||coalesce(c."companyName",'')),'áéíóúñ','aeiouñ') ~ '(genesis|fany|fanny|cordoba|roso|rozo)')
ORDER BY 1, p.created_at DESC;
SQL
