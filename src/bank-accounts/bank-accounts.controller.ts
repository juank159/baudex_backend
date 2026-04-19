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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { BankAccountQueryDto } from './dto/bank-account-query.dto';
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
}
