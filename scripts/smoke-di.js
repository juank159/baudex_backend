#!/usr/bin/env node
/**
 * Smoke test de Dependency Injection.
 *
 * Arranca NestFactory.create(AppModule) sin abrir puertos ni conectar a la
 * base de datos real (pone SKIP_DB=true), para detectar errores de DI
 * ("Can't resolve dependencies of X") antes de hacer push o deploy.
 *
 * Falla con exit code 1 si algún provider no resuelve, haciendo fácil
 * engancharlo a un hook de git o a CI.
 *
 * Uso:
 *   npm run smoke:di
 */
const path = require('node:path');

const DIST_APP_MODULE = path.join(__dirname, '..', 'dist', 'app.module.js');

async function main() {
  // Aseguramos que dist existe y es reciente. Si no, avisamos.
  try {
    require.resolve(DIST_APP_MODULE);
  } catch {
    console.error('[smoke:di] No se encuentra dist/app.module.js. Corre `npm run build` antes.');
    process.exit(1);
  }

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require(DIST_APP_MODULE);

  const timeout = setTimeout(() => {
    console.error('[smoke:di] Timeout (30s) esperando que Nest resolviera dependencias.');
    process.exit(1);
  }, 30_000);

  try {
    const app = await NestFactory.create(AppModule, { logger: ['error'] });
    // No hace falta listen: DI ya se resolvió al llegar aquí.
    await app.close();
    clearTimeout(timeout);
    console.log('[smoke:di] OK — todas las dependencias resuelven.');
    process.exit(0);
  } catch (err) {
    clearTimeout(timeout);
    console.error('[smoke:di] FAIL — error de DI:\n', err.message || err);
    process.exit(1);
  }
}

main();
