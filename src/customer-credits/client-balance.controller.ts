// src/customer-credits/client-balance.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ClientBalanceService,
  UseBalanceDto,
  RefundBalanceDto,
  AdjustBalanceDto,
} from './client-balance.service';
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

/**
 * DTO para depositar saldo
 */
class DepositBalanceDto {
  customerId: string;
  amount: number;
  description: string;
  relatedCreditId?: string;
}

@ApiTags('Client Balance (Saldo a Favor)')
@ApiBearerAuth()
@Controller('client-balance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClientBalanceController {
  constructor(private readonly balanceService: ClientBalanceService) {}

  /**
   * Obtener todos los saldos a favor (balance > 0)
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener todos los saldos a favor' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes con saldo a favor',
  })
  findAll() {
    return this.balanceService.getAllClientBalances();
  }

  /**
   * Obtener el saldo de un cliente específico
   */
  @Get('customer/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener saldo de un cliente' })
  @ApiResponse({ status: 200, description: 'Saldo del cliente' })
  getClientBalance(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.balanceService.getClientBalance(customerId);
  }

  /**
   * Verificar rápidamente si un cliente tiene saldo disponible
   * Útil para mostrar indicadores en UI antes de crear facturas/créditos
   */
  @Get('customer/:customerId/available')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Verificar saldo disponible de un cliente' })
  @ApiResponse({
    status: 200,
    description: 'Información de saldo disponible',
    schema: {
      properties: {
        hasBalance: { type: 'boolean', description: 'Si tiene saldo > 0' },
        amount: { type: 'number', description: 'Monto disponible' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
      },
    },
  })
  async getAvailableBalance(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.balanceService.getAvailableBalance(customerId);
  }

  /**
   * Obtener historial de transacciones de saldo de un cliente
   */
  @Get('customer/:customerId/transactions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Obtener historial de transacciones de saldo' })
  @ApiResponse({
    status: 200,
    description: 'Historial de transacciones de saldo',
  })
  getClientTransactions(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.balanceService.getClientTransactions(customerId);
  }

  /**
   * Depositar saldo a un cliente (crear saldo a favor)
   */
  @Post('deposit')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Depositar saldo a favor de un cliente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', format: 'uuid' },
        amount: { type: 'number', minimum: 0.01 },
        description: { type: 'string' },
        relatedCreditId: { type: 'string', format: 'uuid' },
      },
      required: ['customerId', 'amount', 'description'],
    },
  })
  @ApiResponse({ status: 200, description: 'Saldo depositado exitosamente' })
  depositBalance(@Body() dto: DepositBalanceDto, @GetUser() user: User) {
    return this.balanceService.depositBalance(
      dto.customerId,
      dto.amount,
      dto.description,
      user.id,
      dto.relatedCreditId,
    );
  }

  /**
   * Usar saldo a favor para pagar un crédito
   */
  @Post('use')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Usar saldo a favor para pagar crédito' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', format: 'uuid' },
        amount: { type: 'number', minimum: 0.01 },
        description: { type: 'string' },
        relatedCreditId: { type: 'string', format: 'uuid' },
      },
      required: ['clientId', 'amount', 'description'],
    },
  })
  @ApiResponse({ status: 200, description: 'Saldo usado exitosamente' })
  useBalance(@Body() dto: UseBalanceDto, @GetUser() user: User) {
    return this.balanceService.useBalance(dto, user.id);
  }

  /**
   * Reembolsar saldo a favor (devolver dinero al cliente)
   */
  @Post('refund')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reembolsar saldo a favor al cliente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', format: 'uuid' },
        amount: { type: 'number', minimum: 0.01 },
        description: { type: 'string' },
        paymentMethod: { type: 'string' },
      },
      required: ['clientId', 'amount', 'description', 'paymentMethod'],
    },
  })
  @ApiResponse({ status: 200, description: 'Saldo reembolsado exitosamente' })
  refundBalance(@Body() dto: RefundBalanceDto, @GetUser() user: User) {
    return this.balanceService.refundBalance(dto, user.id);
  }

  /**
   * Ajustar saldo manualmente (corrección administrativa)
   */
  @Post('adjust')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ajustar saldo manualmente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', format: 'uuid' },
        amount: {
          type: 'number',
          description: 'Positivo para aumentar, negativo para reducir',
        },
        description: { type: 'string' },
      },
      required: ['clientId', 'amount', 'description'],
    },
  })
  @ApiResponse({ status: 200, description: 'Saldo ajustado exitosamente' })
  adjustBalance(@Body() dto: AdjustBalanceDto, @GetUser() user: User) {
    return this.balanceService.adjustBalance(dto, user.id);
  }
}
