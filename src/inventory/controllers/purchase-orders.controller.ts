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
import { PurchaseOrdersService } from '../services/purchase-orders.service';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { ReceivePurchaseOrderDto } from '../dto/receive-purchase-order.dto';
import { SendPurchaseOrderDto } from '../dto/send-purchase-order.dto';
import { PurchaseOrderQueryDto } from '../dto/inventory-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva orden de compra' })
  @ApiResponse({
    status: 201,
    description: 'Orden de compra creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({
    status: 404,
    description: 'Proveedor o producto no encontrado',
  })
  async create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.purchaseOrdersService.create(
      createPurchaseOrderDto,
      organizationId,
      user.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de órdenes de compra' })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes obtenida exitosamente',
  })
  async findAll(
    @Query() query: PurchaseOrderQueryDto,
    @TenantId() organizationId: string,
  ) {
    return this.purchaseOrdersService.findAll(query, organizationId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de órdenes de compra' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  async getStats(@TenantId() organizationId: string) {
    return this.purchaseOrdersService.getOrderStats(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener orden de compra por ID' })
  @ApiResponse({ status: 200, description: 'Orden de compra encontrada' })
  @ApiResponse({ status: 404, description: 'Orden de compra no encontrada' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
  ) {
    return this.purchaseOrdersService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar orden de compra' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede modificar en el estado actual',
  })
  @ApiResponse({ status: 404, description: 'Orden de compra no encontrada' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @TenantId() organizationId: string,
  ) {
    return this.purchaseOrdersService.update(
      id,
      updatePurchaseOrderDto,
      organizationId,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar orden de compra' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra aprobada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden aprobar órdenes pendientes',
  })
  @ApiResponse({ status: 404, description: 'Orden de compra no encontrada' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.purchaseOrdersService.approve(id, organizationId, user.id);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Enviar orden de compra al proveedor' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra enviada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden enviar órdenes aprobadas',
  })
  @ApiResponse({ status: 404, description: 'Orden de compra no encontrada' })
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() sendDto: SendPurchaseOrderDto,
    @TenantId() organizationId: string,
  ) {
    return this.purchaseOrdersService.send(id, organizationId, sendDto.notes);
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Recibir mercancía de orden de compra' })
  @ApiResponse({ status: 200, description: 'Mercancía recibida exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'No se puede recibir en el estado actual',
  })
  @ApiResponse({ status: 404, description: 'Orden de compra no encontrada' })
  async receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() receiveDto: ReceivePurchaseOrderDto,
    @TenantId() organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.purchaseOrdersService.receive(
      id,
      receiveDto,
      organizationId,
      user.id,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar orden de compra' })
  @ApiResponse({
    status: 200,
    description: 'Orden de compra cancelada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede cancelar una orden recibida',
  })
  @ApiResponse({ status: 404, description: 'Orden de compra no encontrada' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @TenantId() organizationId: string,
  ) {
    return this.purchaseOrdersService.cancel(id, organizationId, reason);
  }
}
