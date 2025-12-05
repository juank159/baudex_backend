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
}
