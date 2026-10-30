#!/usr/bin/env bash
# SOLO LEE: ¿producción tiene aplicadas todas las migraciones del código?
set -e
cd "$(dirname "$0")/../.."
URL="$(grep -E '^#? *external_host=' .env | head -1 | sed -E 's/^#? *external_host=//')"
[ -n "$URL" ] || { echo "No encontré external_host en el .env"; exit 1; }
CODE=$(grep -ho "export class [A-Za-z0-9_]*" src/database/migrations/*.ts | awk '{print $3}' | sort)
APPLIED=$(PGOPTIONS='-c default_transaction_read_only=on' PGCONNECT_TIMEOUT=15 psql "$URL" -X -At -c "SELECT name FROM migrations" | sort)
PENDING=$(comm -23 <(echo "$CODE") <(echo "$APPLIED"))
echo "Migraciones en el código: $(echo "$CODE" | wc -l | tr -d ' ')"
echo "Aplicadas en producción:  $(echo "$APPLIED" | wc -l | tr -d ' ')"
if [ -z "$PENDING" ]; then
  echo "✅ No hay migraciones pendientes."
else
  echo "⚠️  Pendientes (se aplican solas cuando el servidor arranca con la versión nueva):"
  echo "$PENDING"
fi
echo "Últimas 3 aplicadas:"
PGOPTIONS='-c default_transaction_read_only=on' psql "$URL" -X -At -c "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 3"
