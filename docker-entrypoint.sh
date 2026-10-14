#!/bin/sh
# Entrypoint para producción.
#
# Arranca el servidor. Las migraciones pendientes las aplica el propio
# servidor al iniciar (src/database/run-migrations-on-startup.ts), antes de
# atender peticiones: todas en una sola transacción, con candado para que
# solo un servidor migre a la vez, y deteniéndose si una migración borra
# información sin autorización. Si una migración falla, el servidor no
# arranca (mejor detenido que atendiendo con la base a medio actualizar).
#
# Así funciona igual aunque Dokploy use este entrypoint o su propio comando
# de arranque.
#
# Esto vive como ENTRYPOINT (no CMD) para que Dokploy / docker-compose
# no puedan reemplazarlo accidentalmente desde su UI con un
# "Start command" custom.

set -e

echo "[entrypoint] Arrancando server (aplica migraciones pendientes al iniciar)…"

exec node --dns-result-order=ipv4first dist/main "$@"
