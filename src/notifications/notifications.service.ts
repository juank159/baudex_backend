import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import {
  Notification,
  NotificationSeverity,
} from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

/**
 * 🔔 NOTIFICATION SERVICE
 * Servicio profesional para gestión de notificaciones con soporte multitenant
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * 🔴 CREAR NOTIFICACIÓN
   * Método principal para generar notificaciones
   */
  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    try {
      // Validar que organizationId y userId no estén vacíos
      if (!createNotificationDto.organizationId) {
        throw new BadRequestException('organizationId es requerido');
      }

      if (!createNotificationDto.userId) {
        throw new BadRequestException('userId es requerido');
      }

      // Establecer severidad por defecto si no se especifica
      if (!createNotificationDto.severity) {
        createNotificationDto.severity = NotificationSeverity.INFO;
      }

      // Crear la notificación
      const notification = this.notificationRepository.create({
        organizationId: createNotificationDto.organizationId,
        userId: createNotificationDto.userId,
        type: createNotificationDto.type,
        severity: createNotificationDto.severity,
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        metadata: createNotificationDto.metadata || {},
        expiresAt: createNotificationDto.expiresAt,
      });

      const saved = await this.notificationRepository.save(notification);

      this.logger.log(
        `✅ Notificación creada: ${saved.type} para usuario ${saved.userId} (Org: ${saved.organizationId})`,
      );

      // TODO: Si sendEmail = true, enviar email (Fase 1.5)
      // if (createNotificationDto.sendEmail) {
      //   await this.emailService.sendNotificationEmail(saved);
      // }

      return saved;
    } catch (error) {
      this.logger.error(
        `❌ Error creando notificación: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 📋 OBTENER NOTIFICACIONES CON FILTROS (MULTITENANT)
   */
  async findAll(
    userId: string,
    organizationId: string,
    query: QueryNotificationsDto,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.organizationId = :organizationId', {
        organizationId,
      })
      .andWhere('notification.deletedAt IS NULL');

    // Filtro por tipo
    if (query.type) {
      queryBuilder.andWhere('notification.type = :type', { type: query.type });
    }

    // Filtro por severidad
    if (query.severity) {
      queryBuilder.andWhere('notification.severity = :severity', {
        severity: query.severity,
      });
    }

    // Filtro por leídas/no leídas
    if (query.isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', {
        isRead: query.isRead,
      });
    }

    // Orden cronológico inverso (más recientes primero)
    queryBuilder.orderBy('notification.createdAt', 'DESC');

    // Paginación
    queryBuilder.skip(query.offset || 0);
    queryBuilder.take(query.limit || 20);

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return { notifications, total };
  }

  /**
   * 🔔 OBTENER SOLO NOTIFICACIONES NO LEÍDAS
   */
  async findUnread(
    userId: string,
    organizationId: string,
    limit: number = 10,
  ): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: {
        userId,
        organizationId,
        isRead: false,
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * 🔢 CONTADOR DE NOTIFICACIONES NO LEÍDAS
   * Endpoint ultra-rápido para el badge del frontend
   */
  async getUnreadCount(
    userId: string,
    organizationId: string,
  ): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        organizationId,
        isRead: false,
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * 👁️ MARCAR COMO LEÍDA
   */
  async markAsRead(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<Notification> {
    // Buscar con validación multitenant
    const notification = await this.notificationRepository.findOne({
      where: {
        id,
        userId,
        organizationId,
      },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notificación ${id} no encontrada o no pertenece al usuario`,
      );
    }

    // Marcar como leída
    notification.isRead = true;
    notification.readAt = new Date();

    return this.notificationRepository.save(notification);
  }

  /**
   * 👁️ MARCAR TODAS COMO LEÍDAS
   */
  async markAllAsRead(
    userId: string,
    organizationId: string,
  ): Promise<{ affected: number }> {
    const result = await this.notificationRepository.update(
      {
        userId,
        organizationId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    this.logger.log(
      `✅ ${result.affected} notificaciones marcadas como leídas para usuario ${userId}`,
    );

    return { affected: result.affected || 0 };
  }

  /**
   * 🗑️ ELIMINAR NOTIFICACIÓN (Soft Delete)
   */
  async remove(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    // Buscar con validación multitenant
    const notification = await this.notificationRepository.findOne({
      where: {
        id,
        userId,
        organizationId,
      },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notificación ${id} no encontrada o no pertenece al usuario`,
      );
    }

    await this.notificationRepository.softDelete(id);
    this.logger.log(`🗑️ Notificación ${id} eliminada (soft delete)`);
  }

  /**
   * 🧹 LIMPIAR NOTIFICACIONES EXPIRADAS
   * Método para ejecutar en cron job diario
   */
  async cleanExpiredNotifications(): Promise<number> {
    this.logger.log('🧹 Limpiando notificaciones expiradas...');

    const result = await this.notificationRepository.softDelete({
      expiresAt: LessThan(new Date()),
      deletedAt: IsNull(),
    });

    const count = result.affected || 0;

    if (count > 0) {
      this.logger.log(`✅ ${count} notificaciones expiradas eliminadas`);
    } else {
      this.logger.log('✅ No hay notificaciones expiradas');
    }

    return count;
  }

  /**
   * 🧹 LIMPIAR NOTIFICACIONES ANTIGUAS (30+ días y leídas)
   * Método para ejecutar en cron job semanal
   */
  async cleanOldNotifications(daysOld: number = 30): Promise<number> {
    this.logger.log(
      `🧹 Limpiando notificaciones leídas de hace más de ${daysOld} días...`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationRepository.softDelete({
      isRead: true,
      createdAt: LessThan(cutoffDate),
      deletedAt: IsNull(),
    });

    const count = result.affected || 0;

    if (count > 0) {
      this.logger.log(
        `✅ ${count} notificaciones antiguas (${daysOld}+ días) eliminadas`,
      );
    } else {
      this.logger.log('✅ No hay notificaciones antiguas para limpiar');
    }

    return count;
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DE NOTIFICACIONES
   * Para dashboards y reportes
   */
  async getStatistics(
    userId: string,
    organizationId: string,
  ): Promise<{
    total: number;
    unread: number;
    bySeverity: { info: number; warning: number; critical: number };
  }> {
    const [total, unread, info, warning, critical] = await Promise.all([
      // Total de notificaciones
      this.notificationRepository.count({
        where: { userId, organizationId, deletedAt: IsNull() },
      }),

      // No leídas
      this.notificationRepository.count({
        where: { userId, organizationId, isRead: false, deletedAt: IsNull() },
      }),

      // Por severidad
      this.notificationRepository.count({
        where: {
          userId,
          organizationId,
          severity: NotificationSeverity.INFO,
          deletedAt: IsNull(),
        },
      }),
      this.notificationRepository.count({
        where: {
          userId,
          organizationId,
          severity: NotificationSeverity.WARNING,
          deletedAt: IsNull(),
        },
      }),
      this.notificationRepository.count({
        where: {
          userId,
          organizationId,
          severity: NotificationSeverity.CRITICAL,
          deletedAt: IsNull(),
        },
      }),
    ]);

    return {
      total,
      unread,
      bySeverity: {
        info,
        warning,
        critical,
      },
    };
  }
}
