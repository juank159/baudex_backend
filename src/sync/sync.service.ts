import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SuppliersService } from '../suppliers/suppliers.service';
import { applyJoins, SYNC_ENTITIES, SyncEntityDefinition } from './sync-entities';

/** Cursor inicial: "desde siempre" (descarga completa). */
export const SYNC_EPOCH = '1970-01-01T00:00:00.000000Z';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Margen hacia atrás de la marca que se le entrega a la app. Una transacción
 * graba `updated_at` con la hora en que EMPEZÓ, pero sus cambios solo se ven
 * cuando termina; si tarda, sus filas quedarían "antes" de la marca. Con el
 * margen, la siguiente descarga las vuelve a pedir (guardar dos veces lo
 * mismo no hace daño).
 */
const WATERMARK_OVERLAP = '2 minutes';

/** Cuánto tiempo se guardan los borrados definitivos. */
const DELETIONS_RETENTION_DAYS = 90;

const TIMESTAMP_FORMAT = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;

export interface SyncChangesQuery {
  since?: string;
  afterId?: string;
  limit?: number;
}

export interface SyncChangesResult {
  entity: string;
  /** Registros nuevos o modificados, en la misma forma que el listado. */
  items: any[];
  /** `updated_at` exacto (microsegundos, UTC) de cada registro de `items`. */
  stamps: string[];
  /** IDs borrados desde `since` (solo en la primera página de una descarga). */
  deletedIds: string[];
  hasMore: boolean;
  /** Cursor para pedir la página siguiente (si `hasMore`). */
  next: { since: string; afterId: string } | null;
  /**
   * Marca a guardar cuando se terminen de pedir todas las páginas: la
   * próxima descarga pide desde aquí. Solo en la primera página.
   */
  watermark: string | null;
  /**
   * La marca de la app es más vieja que el registro de borrados: debe hacer
   * una descarga completa (y quitar lo que ya no exista).
   */
  resetRequired: boolean;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private lastDeletionsPurgeAt = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly suppliersService: SuppliersService,
  ) {}

  async getChanges(
    entityKey: string,
    organizationId: string,
    userId: string | undefined,
    query: SyncChangesQuery,
  ): Promise<SyncChangesResult> {
    const def = SYNC_ENTITIES[entityKey];
    if (!def) {
      throw new BadRequestException(`Entidad no sincronizable: ${entityKey}`);
    }
    if (def.perUser && !userId) {
      throw new BadRequestException('Usuario requerido');
    }

    const since = this.parseCursorTime(query.since ?? SYNC_EPOCH);
    const afterId = query.afterId ? this.parseUuid(query.afterId) : null;
    const limit = Math.min(Math.max(Number(query.limit) || 200, 1), 500);
    const isFirstPage = afterId === null;
    const isFullDownload = since.startsWith('1970-');

    // La marca se toma ANTES de leer: todo lo que cambie después queda por
    // encima de ella y llega en la próxima descarga.
    let watermark: string | null = null;
    let resetRequired = false;
    if (isFirstPage) {
      const [row] = await this.dataSource.query(
        `SELECT to_char((clock_timestamp() - interval '${WATERMARK_OVERLAP}') AT TIME ZONE 'UTC', ${TIMESTAMP_FORMAT}) AS watermark,
                ($1::timestamptz < now() - interval '${DELETIONS_RETENTION_DAYS} days') AS too_old`,
        [since],
      );
      watermark = row.watermark;
      resetRequired = !isFullDownload && row.too_old === true;
      if (resetRequired) {
        return {
          entity: entityKey,
          items: [],
          stamps: [],
          deletedIds: [],
          hasMore: false,
          next: null,
          watermark: null,
          resetRequired: true,
        };
      }
      this.purgeOldDeletions();
    }

    // Paso 1: qué filas cambiaron (solo id + updated_at, usando el índice
    // por organización/updated_at/id). Una de más para saber si hay otra
    // página.
    const params: any[] = [organizationId, since, afterId ?? ZERO_UUID, limit + 1];
    const userFilter = def.perUser ? `AND e.user_id = $5` : '';
    if (def.perUser) params.push(userId);
    const changed: Array<{ id: string; stamp: string }> =
      await this.dataSource.query(
        `SELECT e.id, to_char(e.updated_at AT TIME ZONE 'UTC', ${TIMESTAMP_FORMAT}) AS stamp
         FROM "${def.table}" e
         ${this.tenantJoin(def)}
         WHERE ${this.tenantWhere(def)}
           AND e.deleted_at IS NULL
           ${userFilter}
           AND (e.updated_at, e.id) > ($2::timestamptz, $3::uuid)
         ORDER BY e.updated_at, e.id
         LIMIT $4`,
        params,
      );

    const hasMore = changed.length > limit;
    const page = hasMore ? changed.slice(0, limit) : changed;

    // Paso 2: cargar esas filas con sus relaciones, igual que el listado.
    const items = await this.loadRows(def, page.map((r) => r.id));

    // Borrados (suaves y definitivos) desde `since`. En una descarga completa
    // no hace falta: la app quita lo que no haya llegado.
    const deletedIds =
      isFirstPage && !isFullDownload
        ? await this.findDeletedIds(def, organizationId, userId, since)
        : [];

    const last = page[page.length - 1];
    return {
      entity: entityKey,
      items,
      stamps: page.map((r) => r.stamp),
      deletedIds,
      hasMore,
      next: hasMore && last ? { since: last.stamp, afterId: last.id } : null,
      watermark,
      resetRequired: false,
    };
  }

  private async loadRows(def: SyncEntityDefinition, ids: string[]): Promise<any[]> {
    if (ids.length === 0) return [];
    const qb = applyJoins(
      this.dataSource.getRepository(def.entity).createQueryBuilder('e'),
      def,
    ).where('e.id IN (:...ids)', { ids });
    const rows = await qb.getMany();
    const byId = new Map(rows.map((row: any) => [row.id, row]));
    const ctx = { suppliersService: this.suppliersService };
    return ids
      .map((id) => byId.get(id))
      .filter((row) => row !== undefined)
      .map((row) => (def.serialize ? def.serialize(row, ctx) : row));
  }

  private async findDeletedIds(
    def: SyncEntityDefinition,
    organizationId: string,
    userId: string | undefined,
    since: string,
  ): Promise<string[]> {
    const params: any[] = [organizationId, since, def.table];
    const userFilter = def.perUser ? `AND e.user_id = $4` : '';
    if (def.perUser) params.push(userId);
    // El borrado suave mueve updated_at (trigger), así que se busca por el
    // mismo índice de la consulta de cambios.
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT e.id
       FROM "${def.table}" e
       ${this.tenantJoin(def)}
       WHERE ${this.tenantWhere(def)}
         AND e.deleted_at IS NOT NULL
         AND e.updated_at >= $2::timestamptz
         ${userFilter}
       UNION
       SELECT d.row_id AS id
       FROM sync_deletions d
       WHERE d.table_name = $3
         AND d.organization_id = $1
         AND d.deleted_at >= $2::timestamptz`,
      params,
    );
    return rows.map((r) => r.id);
  }

  private tenantJoin(def: SyncEntityDefinition): string {
    return def.tenantSql === 'via-product'
      ? 'JOIN products tp ON tp.id = e.product_id'
      : '';
  }

  private tenantWhere(def: SyncEntityDefinition): string {
    return def.tenantSql === 'via-product'
      ? 'tp.organization_id = $1'
      : 'e.organization_id = $1';
  }

  /** Borra del registro los borrados viejos (como mucho una vez por hora). */
  private purgeOldDeletions(): void {
    const now = Date.now();
    if (now - this.lastDeletionsPurgeAt < 60 * 60 * 1000) return;
    this.lastDeletionsPurgeAt = now;
    this.dataSource
      .query(
        `DELETE FROM sync_deletions WHERE deleted_at < now() - interval '${DELETIONS_RETENTION_DAYS} days'`,
      )
      .catch((error) =>
        this.logger.warn(`No se pudo depurar sync_deletions: ${error.message}`),
      );
  }

  /** Valida el cursor de tiempo (ISO 8601) y lo devuelve tal cual. */
  private parseCursorTime(value: string): string {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/.test(value)
    ) {
      throw new BadRequestException(
        'since debe ser una fecha ISO 8601 con zona (ej. 2026-10-14T12:00:00.000000Z)',
      );
    }
    return value;
  }

  private parseUuid(value: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException('afterId debe ser un UUID');
    }
    return value;
  }
}
