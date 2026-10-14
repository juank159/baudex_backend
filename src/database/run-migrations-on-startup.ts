// src/database/run-migrations-on-startup.ts
import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions, MigrationExecutor } from 'typeorm';

/** Llave fija del candado de Postgres para que solo un servidor migre a la vez. */
const MIGRATION_LOCK_KEY = 778899001;

/**
 * Sentencias que borran información. Una migración nueva que las contenga
 * NO se ejecuta automáticamente: el servidor se detiene y avisa, a menos que
 * se autorice a propósito con MIGRATIONS_ALLOW_DESTRUCTIVE=true.
 */
const DESTRUCTIVE_SQL = /\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i;

const logger = new Logger('Migraciones');

/**
 * Crea la conexión a la base y aplica las migraciones pendientes ANTES de que
 * el servidor empiece a atender. Así cada despliegue deja la base al día sin
 * depender de cómo esté configurado el arranque en Dokploy.
 *
 * Protecciones para no perder información:
 *  - Solo corre migraciones pendientes (nunca `synchronize`).
 *  - Todas las pendientes van en UNA transacción: o se aplican todas, o
 *    ninguna (si una falla, la base queda exactamente como estaba).
 *  - Candado de Postgres: si arrancan dos servidores a la vez, solo uno migra;
 *    el otro espera y luego ve que ya no hay pendientes.
 *  - Si una migración pendiente borra tablas, columnas o filas, no se ejecuta
 *    sin autorización explícita (salvo en una base nueva, donde no hay nada
 *    que perder).
 *  - Si algo falla, el servidor NO arranca (mejor detenido que atendiendo con
 *    la base a medio actualizar).
 */
export async function createDataSourceAndMigrate(
  options: DataSourceOptions,
): Promise<DataSource> {
  const dataSource = await new DataSource(options).initialize();

  if (process.env.MIGRATIONS_RUN_ON_STARTUP === 'false') {
    logger.warn('MIGRATIONS_RUN_ON_STARTUP=false: no se aplican migraciones al arrancar');
    return dataSource;
  }

  await dataSource.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
  try {
    const executor = new MigrationExecutor(dataSource);
    const pending = await executor.getPendingMigrations();

    if (pending.length === 0) {
      logger.log('Base de datos al día: no hay migraciones pendientes');
      return dataSource;
    }

    logger.log(`Migraciones pendientes (${pending.length}): ${pending.map((m) => m.name).join(', ')}`);

    const destructive = pending.filter((migration) => {
      const up = (migration.instance as any)?.up;
      return typeof up === 'function' && DESTRUCTIVE_SQL.test(up.toString());
    });
    // En una base NUEVA (sin migraciones aplicadas) no hay información que
    // perder: se instala completa. La protección aplica a bases con historia.
    const executed = await executor.getExecutedMigrations();
    const databaseHasHistory = executed.length > 0;
    if (
      databaseHasHistory &&
      destructive.length > 0 &&
      process.env.MIGRATIONS_ALLOW_DESTRUCTIVE !== 'true'
    ) {
      throw new Error(
        `Se detuvo el arranque: ${destructive.map((m) => m.name).join(', ')} ` +
          'contiene sentencias que borran información (DROP TABLE / DROP COLUMN / TRUNCATE / DELETE FROM). ' +
          'Saque una copia de seguridad, revise la migración y, si es correcta, arranque una vez con ' +
          'MIGRATIONS_ALLOW_DESTRUCTIVE=true.',
      );
    }

    const applied = await dataSource.runMigrations({ transaction: 'all' });
    logger.log(`Migraciones aplicadas (${applied.length}): ${applied.map((m) => m.name).join(', ')}`);
    return dataSource;
  } catch (error) {
    logger.error(`No se pudieron aplicar las migraciones; el servidor no arranca: ${error?.message}`);
    await dataSource.destroy().catch(() => undefined);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource
        .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
        .catch(() => undefined);
    }
  }
}
