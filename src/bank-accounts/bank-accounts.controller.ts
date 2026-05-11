// src/bank-accounts/bank-accounts.controller.ts
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
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { BankAccountQueryDto } from './dto/bank-account-query.dto';
import {
  CreateBankAccountMovementDto,
  TransferBetweenAccountsDto,
} from './dto/create-bank-account-movement.dto';
import { BankAccountMovementType } from './entities/bank-account-movement.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { TenantId } from '../common/decorators/current-tenant.decorator';

@Controller('bank-accounts')
@UseGuards(AuthGuard())
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  /**
   * Crear una nueva cuenta bancaria
   * POST /bank-accounts
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createDto: CreateBankAccountDto,
    @GetUser('id') userId: string,
  ) {
    return this.bankAccountsService.create(createDto, userId);
  }

  /**
   * Obtener todas las cuentas bancarias del tenant
   * GET /bank-accounts
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findAll(@Query() query: BankAccountQueryDto) {
    return this.bankAccountsService.findAll(query);
  }

  /**
   * Obtener solo cuentas activas (para dropdowns/selects)
   * GET /bank-accounts/active
   */
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getActiveAccounts() {
    return this.bankAccountsService.getActiveAccounts();
  }

  /**
   * Obtener resumen de cuentas bancarias con totales de pagos
   * GET /bank-accounts/summary
   */
  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getSummary(
    @TenantId() organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    console.log('📊 Bank Accounts Summary - Organization ID:', organizationId);
    return this.bankAccountsService.getSummary(organizationId, startDate, endDate);
  }

  /**
   * Obtener la cuenta predeterminada
   * GET /bank-accounts/default
   */
  @Get('default')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getDefault() {
    return this.bankAccountsService.getDefault();
  }

  /**
   * Auditar las cuentas bancarias del tenant para detectar discrepancias
   * entre el saldo guardado (`currentBalance`) y el saldo reconstruido
   * desde los movimientos. Devuelve solo cuentas con diferencia.
   *
   * GET /bank-accounts/audit
   */
  @Get('audit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  audit() {
    return this.bankAccountsService.auditAccounts();
  }

  /**
   * Recalcular el balance de una cuenta. Reescribe `balanceAfter` de
   * cada movimiento y actualiza `currentBalance`. Solo admin.
   *
   * POST /bank-accounts/:id/recalculate-balance
   */
  @Post(':id/recalculate-balance')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  recalculateBalance(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankAccountsService.recalculateBalance(id);
  }

  /**
   * Obtener transacciones de una cuenta bancaria
   * GET /bank-accounts/:id/transactions
   */
  @Get(':id/transactions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: any,
  ) {
    console.log(`💳 Obteniendo transacciones de cuenta ${id}`);
    return this.bankAccountsService.getTransactions(id, query);
  }

  /**
   * Obtener una cuenta bancaria por ID
   * GET /bank-accounts/:id
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankAccountsService.findOne(id);
  }

  /**
   * Actualizar una cuenta bancaria
   * PATCH /bank-accounts/:id
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateBankAccountDto,
    @GetUser('id') userId: string,
  ) {
    return this.bankAccountsService.update(id, updateDto, userId);
  }

  /**
   * Establecer una cuenta como predeterminada
   * PATCH /bank-accounts/:id/set-default
   */
  @Patch(':id/set-default')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  setDefault(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankAccountsService.setDefault(id);
  }

  /**
   * Activar/desactivar una cuenta
   * PATCH /bank-accounts/:id/toggle-active
   */
  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankAccountsService.toggleActive(id);
  }

  /**
   * Eliminar (soft delete) una cuenta bancaria
   * DELETE /bank-accounts/:id
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankAccountsService.remove(id);
  }

  // ==================== MOVEMENTS ====================

  /**
   * Listar movements (historial real auditable) de una cuenta.
   * Soporta filtro por rango de fechas y paginación.
   * GET /bank-accounts/:id/movements
   */
  @Get(':id/movements')
  async listMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bankAccountsService.listMovements({
      bankAccountId: id,
      organizationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /**
   * Registrar un movement manual (depósito o retiro). Solo se permiten
   * tipos manuales — los tipos automáticos (INVOICE_PAYMENT, etc.) se
   * crean desde sus módulos correspondientes.
   * POST /bank-accounts/:id/movements
   */
  @Post(':id/movements')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.CREATED)
  async createMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBankAccountMovementDto,
    @TenantId() organizationId: string,
    @GetUser('id') userId: string,
  ) {
    // Permitir solo tipos manuales por este endpoint para evitar que el
    // cliente cree movements de tipos reservados a otros módulos.
    const allowedManualTypes = [
      BankAccountMovementType.DEPOSIT,
      BankAccountMovementType.WITHDRAWAL,
      BankAccountMovementType.ADJUSTMENT,
      BankAccountMovementType.INITIAL_BALANCE,
    ];
    if (!allowedManualTypes.includes(dto.type)) {
      throw new BadRequestException(
        'Solo se permiten movements manuales (deposit, withdrawal, ' +
          'adjustment, initial_balance). Otros tipos se crean desde sus ' +
          'módulos.',
      );
    }
    return this.bankAccountsService.recordMovement({
      bankAccountId: id,
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      movementDate: dto.movementDate ? new Date(dto.movementDate) : undefined,
      organizationId,
      createdById: userId,
    });
  }

  /**
   * Transferencia atómica entre dos cuentas. Genera 2 movements
   * cruzados (transfer_out + transfer_in) en una transacción única.
   * POST /bank-accounts/transfers
   */
  @Post('transfers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async transfer(
    @Body() dto: TransferBetweenAccountsDto,
    @TenantId() organizationId: string,
    @GetUser('id') userId: string,
  ) {
    return this.bankAccountsService.transferBetweenAccounts({
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: dto.amount,
      description: dto.description,
      movementDate: dto.movementDate ? new Date(dto.movementDate) : undefined,
      organizationId,
      createdById: userId,
    });
  }
}
