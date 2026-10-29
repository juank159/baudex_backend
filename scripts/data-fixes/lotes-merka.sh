#!/usr/bin/env bash
# SOLO LEE (modo solo-lectura): lotes de Mercaexpress cuyo COSTO por unidad
# es mayor que el PRECIO DE VENTA por unidad. Deja el detalle en el
# Escritorio (lotes-mercaexpress.csv) y muestra un resumen.
set -e
cd "$(dirname "$0")/../.."
URL="$(grep -E '^#? *external_host=' .env | head -1 | sed -E 's/^#? *external_host=//')"
[ -n "$URL" ] || { echo "No encontré external_host en el .env"; exit 1; }
OUT="$HOME/Desktop/lotes-mercaexpress.csv"
PGOPTIONS='-c default_transaction_read_only=on -c timezone=America/Bogota' PGCONNECT_TIMEOUT=30 \
  psql "$URL" -X -P pager=off -v out="$OUT" <<'SQL'
\set org '8c5a2625-bdcf-4250-bc22-8c57f378273b'
\pset footer off
\set detalle 'WITH precio AS (SELECT DISTINCT ON (pp.product_id) pp.product_id, pp.amount FROM product_prices pp WHERE pp.type = ''price1'' AND pp.status = ''active'' AND pp.deleted_at IS NULL ORDER BY pp.product_id, pp.updated_at DESC), pres AS (SELECT pr.product_id, string_agg(pr.name || '' x'' || pr.factor::numeric(12,2)::text || '' = $'' || pr.price::numeric(14,0)::text, ''; '' ORDER BY pr.factor) AS presentaciones, max(pr.factor) AS factor_max FROM product_presentations pr WHERE pr.deleted_at IS NULL AND pr."isActive" GROUP BY pr.product_id) SELECT p.name AS producto, p.sku, b."batchNumber" AS lote, to_char(b.purchase_date, ''YYYY-MM-DD'') AS fecha_compra, po."poNumber" AS orden_compra, b."originalQuantity"::numeric(14,2) AS cantidad_comprada, b."currentQuantity"::numeric(14,2) AS quedan, b."unitCost"::numeric(14,0) AS costo_unidad_registrado, precio.amount::numeric(14,0) AS precio_venta_unidad, (b."unitCost" - precio.amount)::numeric(14,0) AS pierde_por_unidad, round(b."unitCost" / nullif(precio.amount, 0), 1) AS costo_es_x_veces_precio, pres.presentaciones, CASE WHEN pres.factor_max > 1 THEN (b."unitCost" / pres.factor_max)::numeric(14,0) END AS costo_si_era_por_presentacion, b.status AS estado_lote FROM inventory_batches b JOIN products p ON p.id = b."productId" JOIN precio ON precio.product_id = p.id LEFT JOIN pres ON pres.product_id = p.id LEFT JOIN purchase_orders po ON po.id = b."purchaseOrderId" WHERE b.organization_id = ''8c5a2625-bdcf-4250-bc22-8c57f378273b'' AND p.deleted_at IS NULL AND b."unitCost" > precio.amount ORDER BY p.name, b.purchase_date'

\echo '== Resumen: productos con lotes cuyo costo es MAYOR que el precio de venta'
SELECT count(DISTINCT producto) AS productos, count(*) AS lotes,
       sum(CASE WHEN estado_lote = 'active' THEN 1 ELSE 0 END) AS lotes_activos
FROM (:detalle) d;

\echo '== Los 30 casos más grandes (costo vs. precio)'
SELECT producto, lote, fecha_compra, cantidad_comprada, costo_unidad_registrado AS costo,
       precio_venta_unidad AS precio, costo_es_x_veces_precio AS veces, presentaciones
FROM (:detalle) d ORDER BY costo_es_x_veces_precio DESC NULLS LAST LIMIT 30;

\pset format csv
\o :out
:detalle;
\o
\pset format aligned
\echo '== Detalle completo guardado en el Escritorio: lotes-mercaexpress.csv'
SQL
