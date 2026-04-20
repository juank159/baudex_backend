import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';
import { ProfitabilityService } from '../common/services/profitability.service';
import { DashboardService } from './services/dashboard.service';
import { DashboardActivityService } from './services/dashboard-activity.service';

/**
 * Controlador flaco — solo orquesta. Toda la lógica vive en los services.
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardSimpleController {
  private readonly logger = new Logger(DashboardSimpleController.name);

  constructor(
    private readonly dashboard: DashboardService,
    private readonly activities: DashboardActivityService,
    private readonly profitability: ProfitabilityService,
  ) {}

  @Get('summary')
  async getDashboardSummary(@Query() query: any, @TenantId() organizationId: string) {
    try {
      const startDate = normalizeDate(query.startDate);
      const endDate = normalizeDate(query.endDate);
      if (!startDate || !endDate) {
        throw new InternalServerErrorException('startDate y endDate son requeridos (YYYY-MM-DD)');
      }
      return await this.dashboard.getSummary(organizationId, startDate, endDate);
    } catch (error) {
      this.logger.error('Error en /dashboard/summary', error as Error);
      throw new InternalServerErrorException('Error al obtener resumen del dashboard');
    }
  }

  @Get('activities/recent')
  async getRecentActivities(@Query() query: any, @TenantId() organizationId: string) {
    try {
      const limit = Number(query.limit ?? 10);
      const activities = await this.activities.getRecentActivities(organizationId, limit);
      return {
        success: true,
        data: { data: { activities } },
        meta: { page: 1, limit, totalItems: activities.length, totalPages: 1 },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error en /dashboard/activities/recent', error as Error);
      return {
        success: true,
        data: { data: { activities: [] } },
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('notifications')
  async getDashboardNotifications(@Query() query: any, @TenantId() organizationId: string) {
    try {
      const limit = Number(query.limit ?? 10);
      const notifications = await this.activities.getNotifications(organizationId, limit);
      const unreadCount = notifications.filter(n => !n.isRead).length;
      return {
        success: true,
        data: { data: { notifications, unreadCount } },
        meta: { page: 1, limit, totalItems: notifications.length, totalPages: 1, unreadCount },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error en /dashboard/notifications', error as Error);
      return {
        success: true,
        data: { data: { notifications: [], unreadCount: 0 } },
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0, unreadCount: 0 },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('profitability')
  async getProfitabilityStats(@Query() query: any, @TenantId() organizationId: string) {
    try {
      const startDate = normalizeDate(query.startDate);
      const endDate = normalizeDate(query.endDate);
      const stats = await this.profitability.getProfitabilityStats(
        organizationId,
        startDate ?? undefined,
        endDate ?? undefined,
      );
      return { message: 'Rentabilidad FIFO calculada', ...stats };
    } catch (error) {
      this.logger.error('Error en /dashboard/profitability', error as Error);
      throw new InternalServerErrorException('Error al calcular rentabilidad');
    }
  }
}

const normalizeDate = (v: unknown): string | null => {
  if (!v) return null;
  return String(v).substring(0, 10);
};
