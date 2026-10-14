// src/common/interceptors/idempotency.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { DataSource } from 'typeorm';

/** HTTP 425 Too Early: la misma operación todavía se está procesando. */
const HTTP_TOO_EARLY = 425;

/** Una fila "processing" más vieja que esto quedó huérfana (el servidor se cayó a mitad). */
const STALE_PROCESSING_SECONDS = 120;

/** Cuánto se recuerdan las operaciones ya procesadas. */
const RETENTION_DAYS = 14;

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Idempotencia global para TODAS las escrituras de la API.
 *
 * La app trabaja offline-first: cada cambio se guarda en una cola local y se
 * envía cuando hay conexión. Si la respuesta se pierde (se cae la red, se
 * cierra la app, timeout), la app reenvía la misma operación. Sin esto, cada
 * módulo tendría que protegerse por su cuenta para no crear la venta, el
 * gasto o el movimiento dos veces.
 *
 * Funcionamiento: la app manda el header `Idempotency-Key`, igual en cada
 * reintento de la misma operación. La primera vez se ejecuta y se guarda la
 * respuesta; cualquier repetición con la misma clave (misma organización,
 * método y ruta) devuelve la respuesta guardada SIN volver a ejecutar nada.
 *
 * - Solo se guardan respuestas exitosas. Si la operación falla, la clave se
 *   libera para que el reintento vuelva a evaluarse (p. ej. la caja ya abrió).
 * - Si llega una repetición mientras la primera sigue en curso, responde 425
 *   (reintentable) en vez de ejecutarla en paralelo.
 * - Las peticiones sin el header no se ven afectadas.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Idempotency');

  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const method = String(req.method || '').toUpperCase();
    if (!WRITE_METHODS.has(method)) return next.handle();

    const rawKey = req.get?.('idempotency-key') ?? req.headers?.['idempotency-key'];
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!key || key.length > 200) return next.handle();

    // Solo peticiones autenticadas y con organización: la clave es por tenant.
    const organizationId: string | undefined =
      req.tenant?.id ?? req.user?.organizationId;
    if (!req.user || !organizationId) return next.handle();

    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (path.includes('/auth/') || path.includes('/health')) return next.handle();

    const keyHash = createHash('sha256')
      .update(`${method}|${path}|${key}`)
      .digest('hex');

    return from(this.claim(organizationId, keyHash, method, path, req.user?.id)).pipe(
      mergeMap((claim) => {
        if (claim.kind === 'replay') {
          this.logger.log(`Operación repetida (${method} ${path}) — se devuelve la respuesta guardada, sin ejecutar de nuevo`);
          return of(claim.response);
        }
        if (claim.kind === 'busy') {
          return throwError(
            () =>
              new HttpException(
                'Esta misma operación todavía se está procesando. Reintenta en unos segundos.',
                HTTP_TOO_EARLY,
              ),
          );
        }
        if (claim.kind === 'unavailable') {
          // Si el registro de idempotencia no está disponible, la operación
          // se ejecuta igual: no se bloquea el trabajo del usuario.
          return next.handle();
        }

        const rowId = claim.rowId;
        return next.handle().pipe(
          mergeMap((data) => from(this.complete(rowId, data)).pipe(mergeMap(() => of(data)))),
          catchError((error) =>
            from(this.release(rowId)).pipe(mergeMap(() => throwError(() => error))),
          ),
        );
      }),
    );
  }

  /**
   * Intenta reservar la clave. Devuelve si esta petición debe ejecutarse
   * (`run`), repetir una respuesta guardada (`replay`) o esperar (`busy`).
   */
  private async claim(
    organizationId: string,
    keyHash: string,
    method: string,
    path: string,
    userId?: string,
  ): Promise<
    | { kind: 'run'; rowId: string }
    | { kind: 'replay'; response: any }
    | { kind: 'busy' }
    | { kind: 'unavailable' }
  > {
    try {
      const inserted: { id: string }[] = await this.dataSource.query(
        `INSERT INTO idempotency_keys (organization_id, key_hash, method, path, user_id, status)
         VALUES ($1, $2, $3, $4, $5, 'processing')
         ON CONFLICT (organization_id, key_hash) DO NOTHING
         RETURNING id`,
        [organizationId, keyHash, method, path.substring(0, 500), userId ?? null],
      );
      if (inserted.length > 0) {
        return { kind: 'run', rowId: inserted[0].id };
      }

      const existing: {
        id: string;
        status: string;
        response: any;
        has_response: boolean;
        age_seconds: string;
      }[] = await this.dataSource.query(
        `SELECT id, status, response, (response IS NOT NULL) AS has_response,
                EXTRACT(EPOCH FROM (now() - created_at)) AS age_seconds
           FROM idempotency_keys
          WHERE organization_id = $1 AND key_hash = $2`,
        [organizationId, keyHash],
      );

      // La fila desapareció entre el INSERT y el SELECT (la primera petición
      // falló y liberó la clave): esta petición la toma.
      if (existing.length === 0) {
        return this.claim(organizationId, keyHash, method, path, userId);
      }

      const row = existing[0];
      if (row.status === 'completed') {
        return {
          kind: 'replay',
          response: row.has_response ? row.response?.body : undefined,
        };
      }

      // Sigue "processing". Si es reciente, hay otra petición en curso.
      if (Number(row.age_seconds) < STALE_PROCESSING_SECONDS) {
        return { kind: 'busy' };
      }

      // Quedó huérfana (el servidor se detuvo a mitad): esta petición la
      // toma, solo si nadie más la tomó primero.
      const takenOver: { id: string }[] = await this.dataSource.query(
        `UPDATE idempotency_keys
            SET created_at = now()
          WHERE id = $1 AND status = 'processing'
            AND created_at < now() - ($2 || ' seconds')::interval
      RETURNING id`,
        [row.id, String(STALE_PROCESSING_SECONDS)],
      );
      const rows: any = Array.isArray(takenOver?.[0]) ? takenOver[0] : takenOver;
      return rows && rows.length > 0 ? { kind: 'run', rowId: row.id } : { kind: 'busy' };
    } catch (error) {
      this.logger.error(`No se pudo consultar el registro de idempotencia: ${error?.message}`);
      return { kind: 'unavailable' };
    }
  }

  /** Guarda la respuesta exitosa para devolverla en cualquier repetición. */
  private async complete(rowId: string, data: any): Promise<void> {
    try {
      // Se guarda exactamente lo que se le envía al cliente (mismo JSON).
      const body = data === undefined ? null : JSON.parse(JSON.stringify(data));
      await this.dataSource.query(
        `UPDATE idempotency_keys
            SET status = 'completed', response = $2::json, completed_at = now()
          WHERE id = $1`,
        [rowId, JSON.stringify({ body })],
      );

      // Limpieza ocasional de claves viejas.
      if (Math.random() < 0.005) {
        await this.dataSource.query(
          `DELETE FROM idempotency_keys WHERE created_at < now() - ($1 || ' days')::interval`,
          [String(RETENTION_DAYS)],
        );
      }
    } catch (error) {
      // La operación YA se ejecutó; no se le falla al usuario por no poder
      // guardar la respuesta. Se libera la clave para no dejarla "en curso".
      this.logger.error(`No se pudo guardar la respuesta idempotente: ${error?.message}`);
      await this.release(rowId);
    }
  }

  /** Libera la clave cuando la operación falló: el reintento se evalúa de nuevo. */
  private async release(rowId: string): Promise<void> {
    try {
      await this.dataSource.query(
        `DELETE FROM idempotency_keys WHERE id = $1 AND status = 'processing'`,
        [rowId],
      );
    } catch (error) {
      this.logger.error(`No se pudo liberar la clave de idempotencia: ${error?.message}`);
    }
  }
}
