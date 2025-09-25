import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfitabilityReportService } from './services/profitability-report.service';
import { InventoryValuationReportService } from './services/inventory-valuation-report.service';
import { KardexReportService } from './services/kardex-report.service';
import {
  ProfitabilityReportQueryDto,
  InventoryValuationQueryDto,
  KardexReportQueryDto,
  PurchaseHistoryQueryDto,
  ReportPeriod,
} from './dto/report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly profitabilityService: ProfitabilityReportService,
    private readonly inventoryValuationService: InventoryValuationReportService,
    private readonly kardexService: KardexReportService,
  ) {}

  // ======================== REPORTES DE RENTABILIDAD ========================

  @Get('profitability/products')
  @ApiOperation({ summary: 'Reporte de rentabilidad por producto' })
  @ApiResponse({ status: 200, description: 'Reporte generado exitosamente' })
  async getProductProfitabilityReport(
    @Query() query: ProfitabilityReportQueryDto,
    @TenantId() organizationId: string,
  ) {
    const { startDate, endDate } = this.resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    return this.profitabilityService.getProductProfitabilityReport(
      organizationId,
      query.productId,
      startDate,
      endDate,
    );
  }

  @Get('profitability/products/:productId/trend')
  @ApiOperation({
    summary: 'Tendencia de rentabilidad de un producto específico',
  })
  @ApiResponse({ status: 200, description: 'Tendencia obtenida exitosamente' })
  async getProductProfitabilityTrend(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('months') months: number = 12,
    @TenantId() organizationId: string,
  ) {
    return this.profitabilityService.getProductProfitabilityTrend(
      organizationId,
      productId,
      months,
    );
  }

  @Get('profitability/categories')
  @ApiOperation({ summary: 'Rentabilidad por categorías' })
  @ApiResponse({ status: 200, description: 'Reporte generado exitosamente' })
  async getCategoryProfitabilityReport(
    @Query() query: ProfitabilityReportQueryDto,
    @TenantId() organizationId: string,
  ) {
    const { startDate, endDate } = this.resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    return this.profitabilityService.getCategoryProfitabilityReport(
      organizationId,
      startDate,
      endDate,
    );
  }

  @Get('profitability/top-profitable')
  @ApiOperation({ summary: 'Productos más rentables' })
  @ApiResponse({ status: 200, description: 'Top productos obtenidos' })
  async getTopProfitableProducts(
    @Query() query: ProfitabilityReportQueryDto,
    @TenantId() organizationId: string,
  ) {
    const { startDate, endDate } = this.resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    return this.profitabilityService.getTopProfitableProducts(
      organizationId,
      query.limit || 10,
      startDate,
      endDate,
    );
  }

  @Get('profitability/least-profitable')
  @ApiOperation({ summary: 'Productos menos rentables' })
  @ApiResponse({
    status: 200,
    description: 'Productos con menor rentabilidad obtenidos',
  })
  async getLeastProfitableProducts(
    @Query() query: ProfitabilityReportQueryDto,
    @TenantId() organizationId: string,
  ) {
    const { startDate, endDate } = this.resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    return this.profitabilityService.getLeastProfitableProducts(
      organizationId,
      query.limit || 10,
      startDate,
      endDate,
    );
  }

  // ======================== REPORTES DE VALORACIÓN DE INVENTARIO ========================

  @Get('inventory/valuation/summary')
  @ApiOperation({ summary: 'Resumen de valoración de inventario' })
  @ApiResponse({ status: 200, description: 'Resumen generado exitosamente' })
  async getInventoryValuationSummary(@TenantId() organizationId: string) {
    return this.inventoryValuationService.getInventoryValuationSummary(
      organizationId,
    );
  }

  @Get('inventory/valuation/products')
  @ApiOperation({ summary: 'Valoración detallada por productos' })
  @ApiResponse({
    status: 200,
    description: 'Valoración por productos obtenida',
  })
  async getProductValuationDetails(
    @Query() query: InventoryValuationQueryDto,
    @TenantId() organizationId: string,
  ) {
    return this.inventoryValuationService.getProductValuationDetails(
      organizationId,
      query.productId,
    );
  }

  @Get('inventory/valuation/categories')
  @ApiOperation({ summary: 'Valoración por categorías' })
  @ApiResponse({
    status: 200,
    description: 'Valoración por categorías obtenida',
  })
  async getCategoryValuationSummary(@TenantId() organizationId: string) {
    return this.inventoryValuationService.getCategoryValuationSummary(
      organizationId,
    );
  }

  @Get('inventory/aging')
  @ApiOperation({ summary: 'Reporte de antigüedad de inventario' })
  @ApiResponse({ status: 200, description: 'Reporte de antigüedad generado' })
  async getInventoryAgingReport(@TenantId() organizationId: string) {
    return this.inventoryValuationService.getInventoryAgingReport(
      organizationId,
    );
  }

  // ======================== REPORTES DE KARDEX ========================

  @Get('kardex/product/:productId')
  @ApiOperation({ summary: 'Kardex de producto específico' })
  @ApiResponse({ status: 200, description: 'Kardex generado exitosamente' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async getProductKardex(
    @Param('productId') productId: string,
    @Query() query: KardexReportQueryDto,
    @TenantId() organizationId: string,
  ) {
    // Validación manual del UUID más permisiva
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      throw new BadRequestException('El productId debe ser un UUID válido');
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate
      ? (() => {
          const date = new Date(query.endDate);
          date.setHours(23, 59, 59, 999); // Establecer al final del día
          return date;
        })()
      : undefined;

    return this.kardexService.getProductKardex(
      productId,
      organizationId,
      startDate,
      endDate,
      query.includeBatchDetails || false,
    );
  }

  @Get('kardex/movements/summary')
  @ApiOperation({ summary: 'Resumen de movimientos de inventario' })
  @ApiResponse({ status: 200, description: 'Resumen de movimientos generado' })
  async getMovementSummary(
    @TenantId() organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.kardexService.getMovementSummary(
      organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('kardex/multi-product')
  @ApiOperation({ summary: 'Kardex resumido para múltiples productos' })
  @ApiResponse({ status: 200, description: 'Kardex multi-producto generado' })
  async getMultiProductKardex(
    @TenantId() organizationId: string,
    @Query('productIds') productIds: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const productIdArray = productIds.split(',').filter((id) => id.trim());

    return this.kardexService.getMultiProductKardex(
      productIdArray,
      organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ======================== REPORTES DE HISTORIAL DE PRECIOS ========================

  @Get('purchase-history')
  @ApiOperation({ summary: 'Historial de precios de compra' })
  @ApiResponse({ status: 200, description: 'Historial de precios obtenido' })
  async getPurchaseHistory(
    @Query() query: PurchaseHistoryQueryDto,
    @TenantId() organizationId: string,
  ) {
    // TODO: Implementar servicio de historial de precios
    // Pendiente de implementación completa
    throw new Error('Purchase history reports not fully implemented yet');
  }

  // ======================== MÉTODOS AUXILIARES ========================

  private resolveDateRange(
    period?: ReportPeriod,
    startDate?: string,
    endDate?: string,
  ): { startDate?: Date; endDate?: Date } {
    const now = new Date();
    const result: { startDate?: Date; endDate?: Date } = {};

    if (period && period !== ReportPeriod.CUSTOM) {
      result.endDate = now;

      switch (period) {
        case ReportPeriod.LAST_7_DAYS:
          result.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case ReportPeriod.LAST_30_DAYS:
          result.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case ReportPeriod.LAST_90_DAYS:
          result.startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case ReportPeriod.LAST_6_MONTHS:
          result.startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 6,
            now.getDate(),
          );
          break;
        case ReportPeriod.LAST_YEAR:
          result.startDate = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate(),
          );
          break;
      }
    } else {
      // Usar fechas personalizadas
      if (startDate) result.startDate = new Date(startDate);
      if (endDate) result.endDate = new Date(endDate);
    }

    return result;
  }
}
