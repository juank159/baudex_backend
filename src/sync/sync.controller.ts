import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';
import { SyncService } from './sync.service';

/**
 * Descarga incremental para la app offline: devuelve solo lo que cambió
 * (creado, modificado o borrado) desde la última descarga.
 *
 * GET /sync/changes/:entity?since=<marca>&afterId=<uuid>&limit=200
 *
 * - Primera vez: sin `since` (o `since=1970-01-01T00:00:00.000000Z`) → todo.
 * - Páginas siguientes: `since` y `afterId` de `next`.
 * - Al terminar: guardar `watermark` (de la primera página) como el `since`
 *   de la próxima descarga.
 */
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('changes/:entity')
  getChanges(
    @Param('entity') entity: string,
    @TenantId() organizationId: string,
    @Req() req: any,
    @Query('since') since?: string,
    @Query('afterId') afterId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.syncService.getChanges(entity, organizationId, req.user?.id, {
      since,
      afterId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** GET /sync/count/:entity → { entity, count } (registros vivos). */
  @Get('count/:entity')
  countRows(
    @Param('entity') entity: string,
    @TenantId() organizationId: string,
    @Req() req: any,
  ) {
    return this.syncService.countRows(entity, organizationId, req.user?.id);
  }
}
