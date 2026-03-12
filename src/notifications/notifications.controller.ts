import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import {
  UpdateDynamicNotificationStateDto,
  BulkUpdateDynamicNotificationStateDto,
  SyncDynamicNotificationStatesDto,
  GetDynamicNotificationStatesDto,
} from './dto/dynamic-notification-state.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 🔔 NOTIFICATIONS CONTROLLER
 * API REST para gestión de notificaciones
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * Obtener todas las notificaciones del usuario con filtros
   */
  @Get()
  async findAll(@Req() req, @Query() query: QueryNotificationsDto) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.findAll(userId, organizationId, query);
  }

  /**
   * GET /notifications/unread
   * Obtener solo notificaciones no leídas
   */
  @Get('unread')
  async findUnread(@Req() req, @Query('limit') limit?: number) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.findUnread(
      userId,
      organizationId,
      limit || 10,
    );
  }

  /**
   * GET /notifications/count
   * Contador de notificaciones no leídas (para badge)
   */
  @Get('count')
  async getUnreadCount(@Req() req) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    const count = await this.notificationsService.getUnreadCount(
      userId,
      organizationId,
    );

    return { count };
  }

  /**
   * GET /notifications/statistics
   * Estadísticas de notificaciones
   */
  @Get('statistics')
  async getStatistics(@Req() req) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.getStatistics(userId, organizationId);
  }

  /**
   * PATCH /notifications/:id/read
   * Marcar una notificación como leída
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.markAsRead(id, userId, organizationId);
  }

  /**
   * PATCH /notifications/read-all
   * Marcar todas como leídas
   */
  @Patch('read-all')
  async markAllAsRead(@Req() req) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.markAllAsRead(userId, organizationId);
  }

  /**
   * DELETE /notifications/:id
   * Eliminar una notificación
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    await this.notificationsService.remove(id, userId, organizationId);

    return { message: 'Notificación eliminada exitosamente' };
  }

  // ==================== DYNAMIC NOTIFICATION STATES ====================
  // IMPORTANTE: Las rutas estáticas deben ir ANTES que las rutas con parámetros

  /**
   * GET /notifications/dynamic-states
   * Obtener estados de notificaciones dinámicas
   */
  @Get('dynamic-states')
  async getDynamicNotificationStates(
    @Req() req,
    @Query() query: GetDynamicNotificationStatesDto,
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.getDynamicNotificationStates(
      query.dynamicNotificationIds || [],
      userId,
      organizationId,
    );
  }

  /**
   * GET /notifications/dynamic-states/read-ids
   * Obtener solo los IDs de notificaciones dinámicas marcadas como leídas
   * Endpoint optimizado para sincronización con frontend
   */
  @Get('dynamic-states/read-ids')
  async getReadDynamicNotificationIds(@Req() req) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    const ids = await this.notificationsService.getReadDynamicNotificationIds(
      userId,
      organizationId,
    );

    return { readIds: ids };
  }

  /**
   * PATCH /notifications/dynamic-states/bulk
   * Marcar múltiples notificaciones dinámicas como leídas/no leídas
   * IMPORTANTE: Esta ruta estática debe ir ANTES de la ruta con parámetro
   */
  @Patch('dynamic-states/bulk')
  async bulkUpdateDynamicNotificationStates(
    @Body() dto: BulkUpdateDynamicNotificationStateDto,
    @Req() req,
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.markDynamicNotificationsAsRead(
      dto,
      userId,
      organizationId,
    );
  }

  /**
   * PATCH /notifications/dynamic-states/read-all
   * Marcar todas las notificaciones dinámicas como leídas
   * IMPORTANTE: Esta ruta estática debe ir ANTES de la ruta con parámetro
   */
  @Patch('dynamic-states/read-all')
  async markAllDynamicNotificationsAsRead(@Req() req) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.markAllDynamicNotificationsAsRead(
      userId,
      organizationId,
    );
  }

  /**
   * POST /notifications/dynamic-states/sync
   * Sincronizar estados de notificaciones dinámicas desde el frontend
   */
  @Post('dynamic-states/sync')
  async syncDynamicNotificationStates(
    @Body() dto: SyncDynamicNotificationStatesDto,
    @Req() req,
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.syncDynamicNotificationStates(
      dto,
      userId,
      organizationId,
    );
  }

  /**
   * PATCH /notifications/dynamic-states/:dynamicNotificationId
   * Marcar una notificación dinámica como leída/no leída
   * IMPORTANTE: Esta ruta con parámetro debe ir DESPUÉS de las rutas estáticas
   */
  @Patch('dynamic-states/:dynamicNotificationId')
  async updateDynamicNotificationState(
    @Param('dynamicNotificationId') dynamicNotificationId: string,
    @Body() body: { isRead: boolean },
    @Req() req,
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return this.notificationsService.markDynamicNotificationAsRead(
      { dynamicNotificationId, isRead: body.isRead },
      userId,
      organizationId,
    );
  }

  /**
   * DELETE /notifications/dynamic-states/:dynamicNotificationId
   * Eliminar estado de una notificación dinámica
   */
  @Delete('dynamic-states/:dynamicNotificationId')
  async removeDynamicNotificationState(
    @Param('dynamicNotificationId') dynamicNotificationId: string,
    @Req() req,
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    await this.notificationsService.removeDynamicNotificationState(
      dynamicNotificationId,
      userId,
      organizationId,
    );

    return { message: 'Estado de notificación dinámica eliminado exitosamente' };
  }
}
