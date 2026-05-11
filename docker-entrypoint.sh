#!/bin/sh
# Entrypoint para producción.
#
# Corre las migraciones pendientes de TypeORM ANTES de levantar el
# server. Si una migración falla, el contenedor falla rápido (set -e)
# en vez de arrancar el server contra un schema desactualizado y
# servir 500s al primer request.
#
# Idempotente: TypeORM mantiene la tabla `migrations` con las ya
# aplicadas, así que reinicios subsecuentes sólo corren las pendientes
# (típicamente cero).
#
# Esto vive como ENTRYPOINT (no CMD) para que Dokploy / docker-compose
# no puedan reemplazarlo accidentalmente desde su UI con un
# "Start command" custom. Si alguien necesita arrancar SIN migrar
# (debugging), debe explícitamente sobreescribir el entrypoint con
# `--entrypoint /bin/sh`.

set -e

echo "[entrypoint] Aplicando migraciones de TypeORM…"
node node_modules/typeorm/cli.js migration:run \
  -d dist/database/typeorm.config.js
echo "[entrypoint] Migraciones OK. Arrancando server…"

exec node --dns-result-order=ipv4first dist/main "$@"
