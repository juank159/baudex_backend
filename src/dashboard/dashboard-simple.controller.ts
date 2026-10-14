import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
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
  async getDashboardSummary(
    @Query() query: any,
    @TenantId() organizationId: string,
    @GetUser() user: User,
  ) {
    try {
      const startDate = normalizeDate(query.startDate);
      const endDate = normalizeDate(query.endDate);
      if (!startDate || !endDate) {
        throw new InternalServerErrorException('startDate y endDate son requeridos (YYYY-MM-DD)');
      }
      const summary = await this.dashboard.getSummary(organizationId, startDate, endDate);
      return canSeeProfit(user) ? summary : withoutProfit(summary);
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
  async getProfitabilityStats(
    @Query() query: any,
    @TenantId() organizationId: string,
    @GetUser() user: User,
  ) {
    try {
      const startDate = normalizeDate(query.startDate);
      const endDate = normalizeDate(query.endDate);
      const stats = await this.profitability.getProfitabilityStats(
        organizationId,
        startDate ?? undefined,
        endDate ?? undefined,
      );
      if (!canSeeProfit(user)) {
        return {
          message: 'La rentabilidad solo está disponible para el administrador',
          ...zeroed(stats),
          profitRestricted: true,
        };
      }
      return { message: 'Rentabilidad FIFO calculada', ...stats };
    } catch (error) {
      this.logger.error('Error en /dashboard/profitability', error as Error);
      throw new InternalServerErrorException('Error al calcular rentabilidad');
    }
  }
}

/**
 * La ganancia, el costo de lo vendido y los márgenes del negocio solo los ve
 * el ADMINISTRADOR del tenant. Empleados (rol `user`) y encargados (rol
 * `manager`) reciben esos datos en cero.
 *
 * Se responde 200 con los valores en cero —no 403— a propósito: la app trata
 * cualquier 403 como "suscripción vencida" y mostraría ese aviso por error.
 */
const canSeeProfit = (user: User | undefined): boolean =>
  user?.role === UserRole.ADMIN;

/** Copia de `value` con la misma forma pero sin datos: números en 0, listas vacías. */
const zeroed = (value: any): any => {
  if (typeof value === 'number') return 0;
  if (Array.isArray(value)) return [];
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const copy: Record<string, any> = {};
    for (const key of Object.keys(value)) copy[key] = zeroed(value[key]);
    return copy;
  }
  return value;
};

/** Resumen del dashboard sin los campos de ganancia, costo ni margen. */
const withoutProfit = (summary: any): any => {
  if (!summary || typeof summary !== 'object') return summary;
  const monthly = summary.monthlyStats;
  return {
    ...summary,
    totalCOGS: 0,
    grossProfit: 0,
    netProfit: 0,
    grossMarginPercentage: 0,
    netMarginPercentage: 0,
    totalProfit: 0,
    profitMargin: '0',
    monthlyStats: monthly
      ? {
          currentMonth: monthly.currentMonth ? { ...monthly.currentMonth, profit: 0 } : monthly.currentMonth,
          previousMonth: monthly.previousMonth ? { ...monthly.previousMonth, profit: 0 } : monthly.previousMonth,
        }
      : monthly,
    chartData: summary.chartData
      ? { ...summary.chartData, profit: (summary.chartData.profit || []).map(() => 0) }
      : summary.chartData,
    profitRestricted: true,
  };
};

const normalizeDate = (v: unknown): string | null => {
  if (!v) return null;
  return String(v).substring(0, 10);
};
