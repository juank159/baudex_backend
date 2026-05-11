// src/cash-register/cash-register.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

import { CashRegisterService } from './cash-register.service';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { CashRegisterStatus } from './entities/cash-register.entity';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('cash-register')
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  /**
   * Caja abierta actualmente del tenant. Devuelve null si no hay
   * ninguna abierta. Lo usa el frontend para decidir si mostrar
   * "Abrir caja" o el resumen del turno actual.
   */
  @Get('current')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async getCurrent() {
    return this.service.getCurrentSummary();
  }

  /**
   * Abrir caja con saldo inicial. Falla si ya hay una caja abierta.
   */
  @Post('open')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.CREATED)
  async open(
    @Body() dto: OpenCashRegisterDto,
    @GetUser('id') userId: string,
  ) {
    return this.service.open(dto, userId);
  }

  /**
   * Cerrar caja: el cajero ingresa lo contado físicamente; el server
   * calcula esperado y diferencia, persiste el snapshot final.
   */
  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseCashRegisterDto,
    @GetUser('id') userId: string,
  ) {
    return this.service.close(id, dto, userId);
  }

  /**
   * Obtener una caja por ID (incluye cerradas para reportes).
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /**
   * Historial de cajas. Permite filtrar por status y paginar.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async list(
    @Query('status') status?: CashRegisterStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.list({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
