// src/customer-credits/customer-credits.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomerCreditsService } from './customer-credits.service';
import {
  CreateCustomerCreditDto,
  AddCreditPaymentDto,
  CustomerCreditQueryDto,
} from './dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Customer Credits')
@ApiBearerAuth()
@Controller('customer-credits')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CustomerCreditsController {
  constructor(private readonly creditsService: CustomerCreditsService) {}

  /**
   * Crear un nuevo crédito de cliente
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un crédito de cliente' })
  @ApiResponse({ status: 201, description: 'Crédito creado exitosamente' })
  create(
    @Body() createDto: CreateCustomerCreditDto,
    @GetUser() user: User,
  ) {
    return this.creditsService.create(createDto, user.id);
  }

  /**
   * Obtener todos los créditos con filtros
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener lista de créditos' })
  findAll(@Query() query: CustomerCreditQueryDto) {
    return this.creditsService.findAll(query);
  }

  /**
   * Obtener estadísticas de créditos
   */
  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Obtener estadísticas de créditos' })
  getStats() {
    return this.creditsService.getStats();
  }

  /**
   * Obtener créditos de un cliente específico
   */
  @Get('customer/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener créditos de un cliente' })
  findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.creditsService.findByCustomer(customerId);
  }

  /**
   * Obtener créditos pendientes de un cliente
   */
  @Get('customer/:customerId/pending')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener créditos pendientes de un cliente' })
  findPendingByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.creditsService.findPendingByCustomer(customerId);
  }

  /**
   * Obtener crédito directo (sin factura) pendiente de un cliente
   * Usado para determinar si se debe agregar monto a un crédito existente
   */
  @Get('customer/:customerId/pending-direct')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener crédito directo pendiente de un cliente' })
  @ApiResponse({ status: 200, description: 'Crédito directo pendiente o null' })
  findPendingDirectByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.creditsService.findPendingDirectCreditByCustomer(customerId);
  }

  /**
   * Obtener cuenta corriente consolidada de un cliente
   * Incluye: deudas de facturas, créditos directos, saldo a favor
   */
  @Get('customer/:customerId/account')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Obtener cuenta corriente del cliente',
    description: 'Retorna un resumen consolidado de la situación financiera del cliente: deudas por facturas, créditos directos y saldo a favor'
  })
  @ApiResponse({
    status: 200,
    description: 'Cuenta corriente del cliente',
    schema: {
      properties: {
        customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            currentBalance: { type: 'number' },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalDebt: { type: 'number', description: 'Deuda total' },
            invoiceDebt: { type: 'number', description: 'Deuda por facturas' },
            directCreditDebt: { type: 'number', description: 'Deuda por créditos directos' },
            availableBalance: { type: 'number', description: 'Saldo a favor disponible' },
            netBalance: { type: 'number', description: 'Balance neto (deuda - saldo)' },
          },
        },
        invoiceCredits: { type: 'array', description: 'Créditos originados por facturas' },
        directCredits: { type: 'array', description: 'Créditos directos' },
        clientBalance: {
          type: 'object',
          properties: {
            balance: { type: 'number' },
            lastTransaction: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  getCustomerAccount(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.creditsService.getCustomerAccount(customerId);
  }

  /**
   * Obtener un crédito por ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener un crédito por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.findOne(id);
  }

  /**
   * Agregar un abono al crédito
   */
  @Post(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agregar un abono al crédito' })
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() paymentDto: AddCreditPaymentDto,
    @GetUser() user: User,
  ) {
    return this.creditsService.addPayment(id, paymentDto, user.id);
  }

  /**
   * Obtener pagos de un crédito
   */
  @Get(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener pagos de un crédito' })
  getPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.getPayments(id);
  }

  /**
   * Cancelar un crédito
   */
  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar un crédito' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.cancel(id);
  }

  /**
   * Marcar créditos vencidos
   */
  @Post('mark-overdue')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar créditos vencidos' })
  markOverdue() {
    return this.creditsService.markOverdueCredits();
  }

  /**
   * Eliminar un crédito (soft delete)
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar un crédito' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.softDelete(id);
  }

  /**
   * Agregar monto a un crédito existente (aumentar deuda)
   */
  @Post(':id/add-amount')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agregar monto a un crédito (aumentar deuda)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', minimum: 0.01 },
        description: { type: 'string' },
      },
      required: ['amount', 'description'],
    },
  })
  @ApiResponse({ status: 200, description: 'Monto agregado exitosamente' })
  addAmount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { amount: number; description: string },
    @GetUser() user: User,
  ) {
    return this.creditsService.addAmountToCredit(
      id,
      dto.amount,
      dto.description,
      user.id,
    );
  }

  /**
   * Aplicar saldo a favor del cliente a un crédito
   */
  @Post(':id/apply-balance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aplicar saldo a favor a un crédito' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          minimum: 0.01,
          description: 'Monto a aplicar (opcional, por defecto aplica todo el saldo disponible)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Saldo aplicado exitosamente',
  })
  applyBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { amount?: number },
    @GetUser() user: User,
  ) {
    return this.creditsService.applyClientBalanceManually(id, user.id, dto.amount);
  }

  /**
   * Obtener historial de transacciones de un crédito
   */
  @Get(':id/transactions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener historial de transacciones del crédito' })
  @ApiResponse({
    status: 200,
    description: 'Historial de transacciones del crédito',
  })
  getTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.getTransactions(id);
  }
}
