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
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva venta' })
  @ApiResponse({
    status: 201,
    description: 'Venta creada exitosamente',
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o stock insuficiente',
  })
  @ApiResponse({ status: 404, description: 'Cliente o producto no encontrado' })
  async create(
    @Body() createSaleDto: CreateSaleDto,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ): Promise<SaleResponseDto> {
    return this.salesService.create(createSaleDto, organizationId, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de ventas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ventas obtenida exitosamente',
    type: PaginatedResponseDto<SaleResponseDto>,
  })
  async findAll(
    @Query() query: SaleQueryDto,
    @TenantId() organizationId: string,
  ): Promise<PaginatedResponseDto<SaleResponseDto>> {
    return this.salesService.findAll(query, organizationId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de ventas' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  async getStats(@TenantId() organizationId: string) {
    return this.salesService.getSalesStats(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener venta por ID' })
  @ApiResponse({
    status: 200,
    description: 'Venta encontrada',
    type: SaleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
  ): Promise<SaleResponseDto> {
    return this.salesService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar venta' })
  @ApiResponse({
    status: 200,
    description: 'Venta actualizada exitosamente',
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede modificar en el estado actual',
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSaleDto: UpdateSaleDto,
    @TenantId() organizationId: string,
  ): Promise<SaleResponseDto> {
    return this.salesService.update(id, updateSaleDto, organizationId);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirmar venta' })
  @ApiResponse({
    status: 200,
    description: 'Venta confirmada exitosamente',
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede confirmar en el estado actual',
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ): Promise<SaleResponseDto> {
    return this.salesService.confirm(id, organizationId, user.id);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: 'Marcar venta como entregada' })
  @ApiResponse({
    status: 200,
    description: 'Venta marcada como entregada',
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede entregar en el estado actual',
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
  ): Promise<SaleResponseDto> {
    return this.salesService.deliver(id, organizationId);
  }

  @Post(':id/link-invoice')
  @ApiOperation({ summary: 'Vincular venta con factura' })
  @ApiResponse({
    status: 200,
    description: 'Venta vinculada con factura',
    type: SaleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async linkToInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('invoiceId', ParseUUIDPipe) invoiceId: string,
    @TenantId() organizationId: string,
  ): Promise<SaleResponseDto> {
    return this.salesService.linkToInvoice(id, invoiceId, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar venta' })
  @ApiResponse({ status: 200, description: 'Venta eliminada exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar en el estado actual',
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
  ): Promise<{ message: string }> {
    await this.salesService.remove(id, organizationId);
    return { message: 'Sale deleted successfully' };
  }
}
