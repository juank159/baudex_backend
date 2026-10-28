#!/usr/bin/env bash
# Aplica migrations/consumidor-final-sin-credito.sql en producción.
# Solo pone en 0 el cupo de crédito del Consumidor Final (222222222222).
# No toca deudas, facturas ni pagos. Se puede correr varias veces.
set -e
cd "$(dirname "$0")/../.."
URL="$(grep -E '^#? *external_host=' .env | head -1 | sed -E 's/^#? *external_host=//')"
[ -n "$URL" ] || { echo "No encontré external_host en el .env"; exit 1; }
PGCONNECT_TIMEOUT=15 psql "$URL" -X -P pager=off -v ON_ERROR_STOP=1 \
  -1 -f migrations/consumidor-final-sin-credito.sql
echo '== Resultado (el cupo debe quedar en 0 en todos)'
PGOPTIONS='-c default_transaction_read_only=on' PGCONNECT_TIMEOUT=15 \
  psql "$URL" -X -P pager=off -c "SELECT o.name AS negocio, c.\"creditLimit\" AS cupo FROM customers c LEFT JOIN organizations o ON o.id = c.organization_id WHERE c.\"documentNumber\" = '222222222222' AND c.deleted_at IS NULL ORDER BY 1;"
