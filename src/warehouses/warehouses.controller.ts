import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';
import { InventoryService } from '../inventory/services/inventory.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(
    private readonly warehousesService: WarehousesService,
    private readonly inventoryService: InventoryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear almacén' })
  @ApiResponse({ status: 201, description: 'Almacén creado exitosamente' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un almacén con este código',
  })
  create(
    @TenantId() organizationId: string,
    @Body() createWarehouseDto: CreateWarehouseDto,
  ) {
    return this.warehousesService.create(organizationId, createWarehouseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los almacenes' })
  @ApiResponse({
    status: 200,
    description: 'Lista de almacenes obtenida exitosamente',
  })
  findAll(
    @TenantId() organizationId: string,
    @Query() query: WarehouseQueryDto,
  ) {
    return this.warehousesService.findAll(organizationId, query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener almacenes activos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de almacenes activos obtenida exitosamente',
  })
  findAllActive(@TenantId() organizationId: string) {
    return this.warehousesService.findAllActive(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener almacén por ID' })
  @ApiResponse({ status: 200, description: 'Almacén encontrado exitosamente' })
  @ApiResponse({ status: 404, description: 'Almacén no encontrado' })
  findOne(
    @TenantId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.warehousesService.findOne(organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar almacén' })
  @ApiResponse({ status: 200, description: 'Almacén actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Almacén no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un almacén con este código',
  })
  update(
    @TenantId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(
      organizationId,
      id,
      updateWarehouseDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar almacén' })
  @ApiResponse({ status: 200, description: 'Almacén eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Almacén no encontrado' })
  remove(
    @TenantId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.warehousesService.remove(organizationId, id);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Obtener movimientos de inventario de un almacén' })
  @ApiResponse({
    status: 200,
    description: 'Movimientos obtenidos exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Almacén no encontrado' })
  async getWarehouseMovements(
    @TenantId() organizationId: string,
    @Param('id', ParseUUIDPipe) warehouseId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: string = 'movementDate',
    @Query('sortOrder') sortOrder: string = 'desc',
  ) {
    // Verificar que el almacén existe
    await this.warehousesService.findOne(organizationId, warehouseId);

    // Obtener movimientos filtrados por almacén
    const filters = { warehouseId };

    return await this.inventoryService.getInventoryMovements(
      organizationId,
      page,
      limit,
      filters,
    );
  }

  @Get(':id/balances')
  @ApiOperation({ summary: 'Obtener balances de inventario de un almacén' })
  @ApiResponse({ status: 200, description: 'Balances obtenidos exitosamente' })
  @ApiResponse({ status: 404, description: 'Almacén no encontrado' })
  async getWarehouseBalances(
    @TenantId() organizationId: string,
    @Param('id', ParseUUIDPipe) warehouseId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sortBy') sortBy: string = 'productName',
    @Query('sortOrder') sortOrder: string = 'asc',
  ) {
    // Verificar que el almacén existe
    await this.warehousesService.findOne(organizationId, warehouseId);

    // Obtener balances filtrados por almacén
    const filters = { warehouseId, search, categoryId };

    return await this.inventoryService.getInventoryBalances(
      organizationId,
      page,
      limit,
      filters,
      sortBy,
      sortOrder,
    );
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Obtener estadísticas de inventario de un almacén' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Almacén no encontrado' })
  async getWarehouseStats(
    @TenantId() organizationId: string,
    @Param('id', ParseUUIDPipe) warehouseId: string,
  ) {
    // Verificar que el almacén existe
    await this.warehousesService.findOne(organizationId, warehouseId);

    // Obtener estadísticas de inventario del almacén
    return await this.inventoryService.getWarehouseInventoryStats(
      organizationId,
      warehouseId,
    );
  }

  @Post(':id/set-main')
  @ApiOperation({ summary: 'Establecer un almacén como principal' })
  @ApiResponse({
    status: 200,
    description: 'Almacén principal actualizado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Almacén no activo o datos inválidos',
  })
  @ApiResponse({ status: 404, description: 'Almacén no encontrado' })
  async setMainWarehouse(
    @TenantId() organizationId: string,
    @Param('id', ParseUUIDPipe) warehouseId: string,
  ) {
    return await this.warehousesService.setMainWarehouse(
      organizationId,
      warehouseId,
    );
  }
}
