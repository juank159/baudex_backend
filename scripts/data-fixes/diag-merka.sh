#!/usr/bin/env bash
# SOLO LEE (modo solo-lectura): diagnóstico de Mercaexpress / castrokely09.
set -e
cd "$(dirname "$0")/../.."
URL="$(grep -E '^#? *external_host=' .env | head -1 | sed -E 's/^#? *external_host=//')"
[ -n "$URL" ] || { echo "No encontré external_host en el .env"; exit 1; }
PGOPTIONS='-c default_transaction_read_only=on -c timezone=America/Bogota' PGCONNECT_TIMEOUT=15 \
  psql "$URL" -X -P pager=off <<'SQL'
\set email 'castrokely09@gmail.com'
\echo '== 1) Usuario'
SELECT u.email, u.role, u.status, u."lastLoginAt" AS ultimo_login, o.name AS negocio, o.id AS org
FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.email = :'email';

\echo '== 2) Equipos / sesiones (últimas 10)'
SELECT s.device_info, s.ip_address, s.last_activity_at, s.is_active, s.created_at
FROM active_sessions s JOIN users u ON u.id = s.user_id
WHERE u.email = :'email' ORDER BY s.last_activity_at DESC LIMIT 10;

\echo '== 3) Facturas que llegaron al servidor por día (últimos 7 días)'
SELECT date_trunc('day', i.created_at)::date AS llego, i.status, count(*) AS cantidad, sum(i.total) AS total
FROM invoices i JOIN users u ON u.organization_id = i.organization_id AND u.email = :'email'
WHERE i.created_at > now() - interval '7 days'
GROUP BY 1,2 ORDER BY 1 DESC, 2;

\echo '== 4) Últimas 25 facturas (fecha de venta vs. llegada al servidor)'
SELECT i.number, i.date AS fecha_venta, i.created_at AS llego_servidor,
       round(extract(epoch FROM (i.created_at - i.date))/60) AS minutos_retraso,
       i.status, i.total, coalesce(c."companyName", c."firstName"||' '||c."lastName") AS cliente
FROM invoices i
JOIN users u ON u.organization_id = i.organization_id AND u.email = :'email'
LEFT JOIN customers c ON c.id = i."customerId"
WHERE i.deleted_at IS NULL ORDER BY i.created_at DESC LIMIT 25;

\echo '== 5) Clientes creados o cambiados en los últimos 7 días'
SELECT coalesce(c."companyName", c."firstName"||' '||c."lastName") AS cliente, c."documentNumber" AS doc,
       c.status, c.created_at, c.updated_at, c.deleted_at AS borrado
FROM customers c JOIN users u ON u.organization_id = c.organization_id AND u.email = :'email'
WHERE c.created_at > now() - interval '7 days' OR c.updated_at > now() - interval '7 days'
   OR c.deleted_at > now() - interval '7 days'
ORDER BY greatest(c.created_at, c.updated_at, coalesce(c.deleted_at, c.created_at)) DESC LIMIT 40;

\echo '== 6) Totales de clientes'
SELECT count(*) FILTER (WHERE c.deleted_at IS NULL AND c.status = 'active') AS activos,
       count(*) FILTER (WHERE c.deleted_at IS NULL AND c.status <> 'active') AS inactivos,
       count(*) FILTER (WHERE c.deleted_at IS NOT NULL) AS borrados
FROM customers c JOIN users u ON u.organization_id = c.organization_id AND u.email = :'email';

\echo '== 7) Documentos repetidos (incluye borrados)'
SELECT c."documentNumber" AS doc, count(*) AS veces,
       string_agg(coalesce(c."companyName", c."firstName"||' '||c."lastName") || CASE WHEN c.deleted_at IS NULL THEN '' ELSE ' (borrado)' END, ' | ') AS clientes
FROM customers c JOIN users u ON u.organization_id = c.organization_id AND u.email = :'email'
GROUP BY 1 HAVING count(*) > 1 ORDER BY 2 DESC LIMIT 20;
SQL
