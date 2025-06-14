// src/modules/dashboard/controllers/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { KpiService } from './kpi.service';
import { ReportsService } from './reports.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  CashFlowData,
  CategorySales,
  DashboardSummary,
  ExpensesBreakdown,
  FinancialKPIs,
  PaymentMethodStats,
  SalesChart,
  TopCustomers,
  TopProducts,
} from './interfaces/dashboard.interfaces';
import { ChartQueryDto } from './dto/chart-query.dto';
import { KpiQueryDto } from './dto/kpi-query.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportData } from './interfaces/reports.interfaces';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from 'src/users/entities/user.entity';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly kpiService: KpiService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Obtener resumen del dashboard',
    description:
      'Obtiene un resumen general de ventas, gastos, clientes y productos',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen del dashboard obtenido exitosamente',
    type: Object,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Período de tiempo para el resumen',
    enum: [
      'today',
      'yesterday',
      'last_7_days',
      'last_30_days',
      'this_month',
      'last_month',
      'this_quarter',
      'last_quarter',
      'this_year',
      'last_year',
      'custom',
    ],
  })
  async getDashboardSummary(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardSummary> {
    try {
      return await this.dashboardService.getDashboardSummary(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener el resumen del dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('charts/sales')
  @ApiOperation({
    summary: 'Obtener gráfico de ventas',
    description: 'Obtiene datos para gráficos de ventas por período',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del gráfico de ventas obtenidos exitosamente',
    type: [Object],
  })
  async getSalesChart(@Query() query: ChartQueryDto): Promise<SalesChart[]> {
    try {
      return await this.dashboardService.getSalesChart(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener el gráfico de ventas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('top-products')
  @ApiOperation({
    summary: 'Obtener productos más vendidos',
    description:
      'Lista de productos con mejores ventas en el período especificado',
  })
  @ApiResponse({
    status: 200,
    description: 'Top productos obtenidos exitosamente',
    type: [Object],
  })
  async getTopProducts(
    @Query() query: DashboardQueryDto,
  ): Promise<TopProducts[]> {
    try {
      return await this.dashboardService.getTopProducts(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener los productos más vendidos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('top-customers')
  @ApiOperation({
    summary: 'Obtener mejores clientes',
    description:
      'Lista de clientes con mayores compras en el período especificado',
  })
  @ApiResponse({
    status: 200,
    description: 'Top clientes obtenidos exitosamente',
    type: [Object],
  })
  async getTopCustomers(
    @Query() query: DashboardQueryDto,
  ): Promise<TopCustomers[]> {
    try {
      return await this.dashboardService.getTopCustomers(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener los mejores clientes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('category-sales')
  @ApiOperation({
    summary: 'Obtener ventas por categoría',
    description: 'Distribución de ventas por categorías de productos',
  })
  @ApiResponse({
    status: 200,
    description: 'Ventas por categoría obtenidas exitosamente',
    type: [Object],
  })
  async getCategorySales(
    @Query() query: DashboardQueryDto,
  ): Promise<CategorySales[]> {
    try {
      return await this.dashboardService.getCategorySales(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener las ventas por categoría',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('expenses-breakdown')
  @ApiOperation({
    summary: 'Obtener desglose de gastos',
    description: 'Distribución de gastos por categorías',
  })
  @ApiResponse({
    status: 200,
    description: 'Desglose de gastos obtenido exitosamente',
    type: [Object],
  })
  async getExpensesBreakdown(
    @Query() query: DashboardQueryDto,
  ): Promise<ExpensesBreakdown[]> {
    try {
      return await this.dashboardService.getExpensesBreakdown(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener el desglose de gastos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cash-flow')
  @ApiOperation({
    summary: 'Obtener flujo de caja',
    description: 'Datos de flujo de caja diario para el período especificado',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de flujo de caja obtenidos exitosamente',
    type: [Object],
  })
  async getCashFlow(
    @Query() query: DashboardQueryDto,
  ): Promise<CashFlowData[]> {
    try {
      return await this.dashboardService.getCashFlow(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener el flujo de caja',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('payment-methods')
  @ApiOperation({
    summary: 'Obtener estadísticas de métodos de pago',
    description: 'Distribución de ventas por métodos de pago',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de métodos de pago obtenidas exitosamente',
    type: [Object],
  })
  async getPaymentMethodStats(
    @Query() query: DashboardQueryDto,
  ): Promise<PaymentMethodStats[]> {
    try {
      return await this.dashboardService.getPaymentMethodStats(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener las estadísticas de métodos de pago',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('kpis')
  @ApiOperation({
    summary: 'Obtener KPIs financieros',
    description: 'Indicadores clave de rendimiento financiero',
  })
  @ApiResponse({
    status: 200,
    description: 'KPIs obtenidos exitosamente',
    type: Object,
  })
  async getFinancialKPIs(@Query() query: KpiQueryDto): Promise<FinancialKPIs> {
    try {
      return await this.kpiService.getFinancialKPIs(query);
    } catch (error) {
      throw new HttpException(
        'Error al obtener los KPIs financieros',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metrics/sales')
  @ApiOperation({
    summary: 'Obtener métricas de ventas',
    description: 'Métricas detalladas de ventas para el período especificado',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de ventas obtenidas exitosamente',
    type: Object,
  })
  async getSalesMetrics(@Query() query: KpiQueryDto) {
    try {
      const { startDate, endDate } = this.getDateRange(
        query.startDate,
        query.endDate,
      );
      return await this.kpiService.getSalesMetrics(startDate, endDate);
    } catch (error) {
      throw new HttpException(
        'Error al obtener las métricas de ventas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metrics/expenses')
  @ApiOperation({
    summary: 'Obtener métricas de gastos',
    description: 'Métricas detalladas de gastos para el período especificado',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de gastos obtenidas exitosamente',
    type: Object,
  })
  async getExpenseMetrics(@Query() query: KpiQueryDto) {
    try {
      const { startDate, endDate } = this.getDateRange(
        query.startDate,
        query.endDate,
      );
      return await this.kpiService.getExpenseMetrics(startDate, endDate);
    } catch (error) {
      throw new HttpException(
        'Error al obtener las métricas de gastos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metrics/customers')
  @ApiOperation({
    summary: 'Obtener métricas de clientes',
    description: 'Métricas detalladas de clientes para el período especificado',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de clientes obtenidas exitosamente',
    type: Object,
  })
  async getCustomerMetrics(@Query() query: KpiQueryDto) {
    try {
      const { startDate, endDate } = this.getDateRange(
        query.startDate,
        query.endDate,
      );
      return await this.kpiService.getCustomerMetrics(startDate, endDate);
    } catch (error) {
      throw new HttpException(
        'Error al obtener las métricas de clientes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metrics/inventory')
  @ApiOperation({
    summary: 'Obtener métricas de inventario',
    description: 'Métricas detalladas del inventario actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de inventario obtenidas exitosamente',
    type: Object,
  })
  async getInventoryMetrics() {
    try {
      return await this.kpiService.getInventoryMetrics();
    } catch (error) {
      throw new HttpException(
        'Error al obtener las métricas de inventario',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('reports/generate')
  @ApiOperation({
    summary: 'Generar reporte',
    description: 'Genera un reporte específico según el tipo solicitado',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
    type: Object,
  })
  async generateReport(
    @Query() query: ReportQueryDto,
    @Request() req: any,
  ): Promise<ReportData> {
    try {
      const userId = req.user?.sub || req.user?.id;
      return await this.reportsService.generateReport(query, userId);
    } catch (error) {
      throw new HttpException(
        'Error al generar el reporte',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Método auxiliar privado
  private getDateRange(
    startDate?: string,
    endDate?: string,
  ): { startDate: Date; endDate: Date } {
    if (startDate && endDate) {
      return {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
    }

    // Por defecto, último mes
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), 0),
    };
  }
}
