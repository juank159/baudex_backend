import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InventoryService } from '../services/inventory.service';
import { KardexReportService } from '../../reports/services/kardex-report.service';
import {
  CreateInventoryMovementDto,
  InventoryAdjustmentDto,
  RelativeInventoryAdjustmentDto,
} from '../dto/inventory-movement.dto';
import {
  TransferResponseDto,
  TransferMovementResponseDto,
} from '../dto/transfer-response.dto';
import {
  InventoryMovementQueryDto,
  InventoryBatchQueryDto,
} from '../dto/inventory-query.dto';
import { MovementType } from '../entities/inventory-movement.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly kardexReportService: KardexReportService,
  ) {}

  private transformMovementForResponse(
    movement: any,
  ): TransferMovementResponseDto {
    return {
      id: movement.id,
      movementNumber: movement.movementNumber,
      type: movement.type,
      status: movement.status,
      movementDate: movement.movementDate,
      quantity: movement.quantity,
      unitCost: movement.unitCost,
      totalCost: movement.totalCost,
      unitPrice: movement.unitPrice ?? null,
      totalPrice: movement.totalPrice ?? null,
      stockAfter: movement.stockAfter,
      stockValueAfter: movement.stockValueAfter,
      referenceType: movement.referenceType ?? null,
      referenceNumber: movement.referenceNumber ?? null,
      referenceId: movement.referenceId ?? null,
      notes: movement.notes ?? null,
      metadata: movement.metadata ?? {},
      organizationId: movement.organizationId,
      productId: movement.productId,
      performedById: movement.performedById,
      warehouseId: movement.warehouseId ?? null,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt,
    };
  }

  @Post('migrate-stock')
  @ApiOperation({
    summary: 'Migrar productos con stock inicial a sistema de lotes',
  })
  @ApiResponse({
    status: 200,
    description: 'Migración completada',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            processed: { type: 'number' },
            migrated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'array' },
          },
        },
      },
    },
  })
  async migrateStock(
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `🚀 Iniciando migración de stock - Organización: ${organizationId}`,
      );

      const results = await this.inventoryService.migrateProductsWithStock(
        organizationId,
        user.id,
      );

      return {
        success: true,
        data: results,
        message: `Migración completada: ${results.migrated} productos migrados, ${results.skipped} omitidos, ${results.errors.length} errores`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error en migración de stock:', error);
      throw new BadRequestException(`Error en migración: ${error.message}`);
    }
  }

  @Post('movements')
  @ApiOperation({ summary: 'Crear movimiento de inventario manual' })
  @ApiResponse({ status: 201, description: 'Movimiento creado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o stock insuficiente',
  })
  async createMovement(
    @Body() createMovementDto: CreateInventoryMovementDto,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    const {
      productId,
      type,
      quantity,
      unitCost,
      unitPrice,
      referenceType,
      referenceId,
      metadata,
      warehouseId,
    } = createMovementDto;

    let result;

    switch (type) {
      case MovementType.PURCHASE:
        if (!unitCost) {
          throw new BadRequestException(
            'Unit cost is required for purchase movements',
          );
        }
        result = await this.inventoryService.registerPurchase(
          productId,
          Math.abs(quantity),
          unitCost,
          organizationId,
          user.id,
          referenceId,
          metadata,
          warehouseId,
        );
        return result.movement;

      case MovementType.SALE:
        if (!unitPrice) {
          throw new BadRequestException(
            'Unit price is required for sale movements',
          );
        }
        result = await this.inventoryService.registerSale(
          productId,
          Math.abs(quantity),
          unitPrice,
          organizationId,
          user.id,
          referenceType,
          referenceId,
          metadata,
          warehouseId,
        );
        return result.movement;

      case MovementType.ADJUSTMENT:
        // Para ajustes manuales, usar el método registerAdjustment
        const currentStock = await this.inventoryService.getCurrentStock(
          productId,
          organizationId,
        );
        const adjustmentQuantity = quantity - currentStock;

        return await this.inventoryService.registerAdjustment(
          productId,
          adjustmentQuantity,
          metadata?.reason || 'Manual adjustment',
          organizationId,
          user.id,
          unitCost,
          metadata,
        );

      default:
        throw new BadRequestException(
          `Movement type ${type} not supported for manual creation`,
        );
    }
  }

  @Get('movements')
  @ApiOperation({ summary: 'Obtener movimientos de inventario' })
  @ApiResponse({ status: 200, description: 'Lista de movimientos obtenida' })
  async getMovements(
    @Query() query: InventoryMovementQueryDto,
    @TenantId() organizationId: string,
  ) {
    const {
      page = 1,
      limit = 20,
      productId,
      type,
      status,
      startDate,
      endDate,
      search,
      warehouseId,
    } = query;

    const filters: any = {};

    if (productId) filters.productId = productId;
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (search) filters.searchTerm = search;
    if (warehouseId) filters.warehouseId = warehouseId;

    return await this.inventoryService.getInventoryMovements(
      organizationId,
      page,
      limit,
      filters,
    );
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Realizar ajuste de inventario' })
  @ApiResponse({ status: 200, description: 'Ajuste realizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async adjustInventory(
    @Body() adjustmentDto: InventoryAdjustmentDto,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    const { productId, newQuantity, reason, unitCost, notes } = adjustmentDto;

    // Obtener stock actual para calcular el ajuste necesario
    const currentStock = await this.inventoryService.getCurrentStock(
      productId,
      organizationId,
    );
    const adjustmentQuantity = newQuantity - currentStock;

    const metadata = notes ? { notes } : undefined;

    return await this.inventoryService.registerAdjustment(
      productId,
      adjustmentQuantity,
      reason,
      organizationId,
      user.id,
      unitCost,
      metadata,
    );
  }

  @Post('adjustments/relative')
  @ApiOperation({
    summary:
      'Realizar ajuste de inventario con cantidad relativa (compatible con frontend)',
  })
  @ApiResponse({ status: 200, description: 'Ajuste realizado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o stock insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async adjustInventoryRelative(
    @Body() adjustmentDto: RelativeInventoryAdjustmentDto,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    const {
      productId,
      adjustmentQuantity,
      warehouseId,
      notes,
      movementDate,
      unitCost,
    } = adjustmentDto;

    // Validar ajuste cantidad
    if (adjustmentQuantity === 0) {
      throw new BadRequestException('Adjustment quantity cannot be zero');
    }

    // Para ajustes positivos, requerir unitCost
    if (adjustmentQuantity > 0 && !unitCost) {
      throw new BadRequestException(
        'Unit cost is required for positive adjustments',
      );
    }

    // Preparar metadatos
    const metadata: any = {};
    if (notes) metadata.notes = notes;
    if (warehouseId) metadata.warehouseId = warehouseId;
    if (movementDate) metadata.movementDate = movementDate;

    // Determinar la razón del ajuste basado en las notas
    const reason =
      notes ||
      (adjustmentQuantity > 0 ? 'Adjustment increase' : 'Adjustment decrease');

    try {
      return await this.inventoryService.registerAdjustment(
        productId,
        adjustmentQuantity,
        reason,
        organizationId,
        user.id,
        unitCost,
        metadata,
      );
    } catch (error) {
      this.logger.error('❌ Error in relative adjustment:', error);
      throw new BadRequestException(`Adjustment failed: ${error.message}`);
    }
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Crear transferencia entre almacenes' })
  @ApiResponse({
    status: 200,
    description: 'Transferencia creada exitosamente',
    type: TransferResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o stock insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async createTransfer(
    @Body()
    transferDto: {
      productId: string;
      quantity: number;
      fromWarehouseId: string;
      toWarehouseId: string;
      notes?: string;
      unitCost?: number;
    },
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    const {
      productId,
      quantity,
      fromWarehouseId,
      toWarehouseId,
      notes,
      unitCost,
    } = transferDto;

    // Validar cantidad
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    // Validar que los almacenes sean diferentes
    if (fromWarehouseId === toWarehouseId) {
      throw new BadRequestException(
        'Origin and destination warehouses must be different',
      );
    }

    try {
      const result = await this.inventoryService.registerTransfer(
        productId,
        quantity,
        fromWarehouseId,
        toWarehouseId,
        organizationId,
        user.id,
        notes,
        unitCost,
      );

      // Transformar y retornar el resultado garantizando tipos seguros
      const transformedResult: TransferResponseDto = {
        transferOut: this.transformMovementForResponse(result.transferOut),
        transferIn: this.transformMovementForResponse(result.transferIn),
      };

      return transformedResult;
    } catch (error) {
      this.logger.error('❌ Error creating transfer:', error);
      throw new BadRequestException(`Transfer failed: ${error.message}`);
    }
  }

  @Get('batches')
  @ApiOperation({ summary: 'Obtener lotes de inventario (todos o por producto)' })
  @ApiResponse({ status: 200, description: 'Lista de lotes obtenida' })
  async getBatches(
    @Query() query: InventoryBatchQueryDto,
    @TenantId() organizationId: string,
  ) {
    const { productId, status, page, limit } = query;

    if (productId) {
      // Si se proporciona productId, devolver batches de ese producto
      return await this.inventoryService.getProductBatches(
        productId,
        organizationId,
        status,
        true, // includeExpired
      );
    }

    // Sin productId: devolver TODOS los batches paginados (para sync offline)
    return await this.inventoryService.getAllBatches(
      organizationId,
      { status, page: page || 1, limit: limit || 100 },
    );
  }

  @Get('products/:productId/stock')
  @ApiOperation({ summary: 'Obtener stock actual de un producto' })
  @ApiResponse({ status: 200, description: 'Stock obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async getProductStock(
    @Param('productId', ParseUUIDPipe) productId: string,
    @TenantId() organizationId: string,
  ) {
    const currentStock = await this.inventoryService.getCurrentStock(
      productId,
      organizationId,
    );
    const availableStock = await this.inventoryService.getAvailableStock(
      productId,
      organizationId,
    );

    return {
      productId,
      currentStock,
      availableStock,
      reservedStock: currentStock - availableStock,
    };
  }

  @Get('products/:productId/valuation')
  @ApiOperation({ summary: 'Obtener valoración de inventario de un producto' })
  @ApiResponse({ status: 200, description: 'Valoración obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async getProductValuation(
    @Param('productId', ParseUUIDPipe) productId: string,
    @TenantId() organizationId: string,
  ) {
    return this.inventoryService.getInventoryValuation(
      productId,
      organizationId,
    );
  }

  @Get('products/:productId/kardex')
  @ApiOperation({
    summary: 'Obtener kardex completo de un producto con saldo inicial',
  })
  @ApiResponse({ status: 200, description: 'Kardex obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async getProductKardex(
    @Param('productId') productId: string,
    @TenantId() organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeBatchDetails') includeBatchDetails?: string,
  ) {
    // Validación manual del UUID más permisiva
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      throw new BadRequestException('El productId debe ser un UUID válido');
    }

    try {
      this.logger.log(
        `🔍 KARDEX REQUEST - Product: ${productId}, Start: ${startDate || 'desde inicio'}, End: ${endDate || 'hasta hoy'}`,
      );

      // ✅ USAR KARDEX REPORT SERVICE CORREGIDO
      const kardexReport = await this.kardexReportService.getProductKardex(
        productId,
        organizationId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        includeBatchDetails === 'true',
      );

      this.logger.log(
        `✅ KARDEX RESPONSE - Initial: ${kardexReport.initialBalance.quantity}, Final: ${kardexReport.finalBalance.quantity}, Movements: ${kardexReport.movements.length}`,
      );

      return {
        success: true,
        data: kardexReport,
        message: `Kardex generado: ${kardexReport.movements.length} movimientos`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error generando kardex:', error);
      throw new BadRequestException(`Error generando kardex: ${error.message}`);
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de inventario' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  async getInventoryStats(
    @TenantId() organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const filters: any = {};

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (warehouseId) filters.warehouseId = warehouseId;
    if (categoryId) filters.categoryId = categoryId;

    return await this.inventoryService.getInventoryStats(
      organizationId,
      filters,
    );
  }

  @Get('balances')
  @ApiOperation({ summary: 'Obtener balances de inventario' })
  @ApiResponse({ status: 200, description: 'Balances obtenidos exitosamente' })
  async getInventoryBalances(
    @TenantId() organizationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('lowStock') lowStock?: boolean,
    @Query('outOfStock') outOfStock?: boolean,
    @Query('nearExpiry') nearExpiry?: boolean,
    @Query('expired') expired?: boolean,
    @Query('sortBy') sortBy: string = 'productName',
    @Query('sortOrder') sortOrder: string = 'asc',
  ) {
    const filters: any = {};

    if (search) filters.search = search;
    if (categoryId) filters.categoryId = categoryId;
    if (warehouseId) filters.warehouseId = warehouseId;
    if (lowStock !== undefined) filters.lowStock = lowStock;
    if (outOfStock !== undefined) filters.outOfStock = outOfStock;
    if (nearExpiry !== undefined) filters.nearExpiry = nearExpiry;
    if (expired !== undefined) filters.expired = expired;

    return await this.inventoryService.getInventoryBalances(
      organizationId,
      page,
      limit,
      filters,
      sortBy,
      sortOrder,
    );
  }

  @Get('balances/low-stock')
  @ApiOperation({ summary: 'Obtener productos con stock bajo' })
  @ApiResponse({
    status: 200,
    description: 'Productos con stock bajo obtenidos exitosamente',
  })
  async getLowStockProducts(
    @TenantId() organizationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const filters = { lowStock: true, warehouseId };
    const validPage = isNaN(Number(page)) ? 1 : Number(page);
    const validLimit = isNaN(Number(limit)) ? 20 : Number(limit);
    return await this.inventoryService.getInventoryBalances(
      organizationId,
      validPage,
      validLimit,
      filters,
    );
  }

  @Get('balances/out-of-stock')
  @ApiOperation({ summary: 'Obtener productos sin stock' })
  @ApiResponse({
    status: 200,
    description: 'Productos sin stock obtenidos exitosamente',
  })
  async getOutOfStockProducts(
    @TenantId() organizationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const filters = { outOfStock: true, warehouseId };
    const validPage = isNaN(Number(page)) ? 1 : Number(page);
    const validLimit = isNaN(Number(limit)) ? 20 : Number(limit);
    return await this.inventoryService.getInventoryBalances(
      organizationId,
      validPage,
      validLimit,
      filters,
    );
  }

  @Get('balances/near-expiry')
  @ApiOperation({ summary: 'Obtener productos próximos a vencer' })
  @ApiResponse({
    status: 200,
    description: 'Productos próximos a vencer obtenidos exitosamente',
  })
  async getNearExpiryProducts(
    @TenantId() organizationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const filters = { nearExpiry: true, warehouseId };
    const validPage = isNaN(Number(page)) ? 1 : Number(page);
    const validLimit = isNaN(Number(limit)) ? 20 : Number(limit);
    return await this.inventoryService.getInventoryBalances(
      organizationId,
      validPage,
      validLimit,
      filters,
    );
  }

  @Get('balances/expired')
  @ApiOperation({ summary: 'Obtener productos vencidos' })
  @ApiResponse({
    status: 200,
    description: 'Productos vencidos obtenidos exitosamente',
  })
  async getExpiredProducts(
    @TenantId() organizationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const filters = { expired: true, warehouseId };
    const validPage = isNaN(Number(page)) ? 1 : Number(page);
    const validLimit = isNaN(Number(limit)) ? 20 : Number(limit);
    return await this.inventoryService.getInventoryBalances(
      organizationId,
      validPage,
      validLimit,
      filters,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen general de inventario' })
  @ApiResponse({ status: 200, description: 'Resumen obtenido exitosamente' })
  async getInventorySummary(
    @TenantId() organizationId: string,
    @Query('productIds') productIds?: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const filters: any = {};

    if (productIds) {
      // Convertir string separado por comas a array
      filters.productIds = productIds.split(',');
    }

    if (includeInactive !== undefined) {
      filters.includeInactive = String(includeInactive) === 'true';
    }

    return await this.inventoryService.getInventorySummary(
      organizationId,
      filters,
    );
  }

  @Get('integrity/validate')
  @ApiOperation({ summary: 'Validar integridad completa del inventario' })
  @ApiResponse({
    status: 200,
    description: 'Validación completada exitosamente',
  })
  async validateInventoryIntegrity(@TenantId() organizationId: string) {
    try {
      this.logger.log(
        `🔍 Validando integridad de inventario - Organización: ${organizationId}`,
      );

      const result =
        await this.inventoryService.validateInventoryIntegrity(organizationId);

      return {
        success: true,
        data: result,
        message: result.isValid
          ? 'Inventario completamente consistente'
          : `Se detectaron ${result.inconsistencies.length} inconsistencias`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error en validación de integridad:', error);
      throw new BadRequestException(
        `Error validando integridad: ${error.message}`,
      );
    }
  }

  @Post('integrity/fix')
  @ApiOperation({
    summary: 'Corregir inconsistencias de inventario automáticamente',
  })
  @ApiResponse({ status: 200, description: 'Corrección completada' })
  @ApiResponse({ status: 400, description: 'Error en la corrección' })
  async fixInventoryInconsistencies(
    @Body()
    body: {
      dryRun?: boolean;
      maxDifferenceToFix?: number;
      autoFix?: boolean;
    },
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `🛠️ Corrigiendo inconsistencias - Organización: ${organizationId}`,
      );

      const options = {
        dryRun: body.dryRun ?? false,
        maxDifferenceToFix: body.maxDifferenceToFix ?? 100,
        autoFix: body.autoFix ?? true,
      };

      const result = await this.inventoryService.fixInventoryInconsistencies(
        organizationId,
        user.id,
        options,
      );

      return {
        success: true,
        data: result,
        message: options.dryRun
          ? `Simulación completada: ${result.fixed + result.skipped} inconsistencias analizadas`
          : `Corrección completada: ${result.fixed} corregidas, ${result.skipped} omitidas`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error corrigiendo inconsistencias:', error);
      throw new BadRequestException(
        `Error corrigiendo inconsistencias: ${error.message}`,
      );
    }
  }

  @Get('integrity/monitor')
  @ApiOperation({ summary: 'Monitoreo continuo de integridad del inventario' })
  @ApiResponse({ status: 200, description: 'Monitoreo ejecutado exitosamente' })
  async monitorInventoryIntegrity(@TenantId() organizationId: string) {
    try {
      this.logger.log(
        `📊 Ejecutando monitoreo de integridad - Organización: ${organizationId}`,
      );

      await this.inventoryService.scheduleIntegrityCheck(organizationId);

      return {
        success: true,
        message: 'Monitoreo de integridad ejecutado exitosamente',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error en monitoreo:', error);
      throw new BadRequestException(`Error en monitoreo: ${error.message}`);
    }
  }

  @Get('diagnostics/full')
  @ApiOperation({ summary: 'Diagnóstico completo del sistema de inventario' })
  @ApiResponse({ status: 200, description: 'Diagnóstico completado' })
  async getFullDiagnostics(@TenantId() organizationId: string) {
    try {
      this.logger.log(
        `🏥 Ejecutando diagnóstico completo - Organización: ${organizationId}`,
      );

      // Ejecutar validación de integridad
      const integrity =
        await this.inventoryService.validateInventoryIntegrity(organizationId);

      // Obtener estadísticas generales
      const stats = await this.inventoryService.getInventoryStats(
        organizationId,
        {},
      );

      // Resumen de balances
      const balances = await this.inventoryService.getInventoryBalances(
        organizationId,
        1,
        1000,
        {},
        'productName',
        'asc',
      );

      // Análisis de inconsistencias críticas
      const criticalIssues = integrity.inconsistencies.filter(
        (i) => i.severity === 'critical',
      );
      const highIssues = integrity.inconsistencies.filter(
        (i) => i.severity === 'high',
      );

      return {
        success: true,
        data: {
          integrity,
          statistics: stats,
          totalProducts: balances.total,
          healthScore: {
            overall: integrity.isValid
              ? 100
              : Math.max(0, 100 - integrity.inconsistencies.length * 10),
            consistency:
              (integrity.summary.consistentProducts /
                integrity.summary.totalProducts) *
              100,
            criticalIssues: criticalIssues.length,
            highIssues: highIssues.length,
          },
          recommendations: [
            ...criticalIssues.map(
              (i) => `🚨 CRÍTICO: ${i.productName} - ${i.recommendation}`,
            ),
            ...highIssues.map(
              (i) => `⚠️ ALTO: ${i.productName} - ${i.recommendation}`,
            ),
            integrity.isValid
              ? '✅ Sistema funcionando perfectamente'
              : '🔧 Se recomienda ejecutar corrección automática',
          ],
        },
        message: `Diagnóstico completado: ${integrity.summary.consistentProducts}/${integrity.summary.totalProducts} productos consistentes`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error en diagnóstico:', error);
      throw new BadRequestException(`Error en diagnóstico: ${error.message}`);
    }
  }
}
