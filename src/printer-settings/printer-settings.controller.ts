import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrinterSettingsService } from './printer-settings.service';
import { CreatePrinterSettingsDto } from './dto/create-printer-settings.dto';
import { UpdatePrinterSettingsDto } from './dto/update-printer-settings.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Configuración de Impresoras')
@Controller('printer-settings')
@UseGuards(AuthGuard())
@ApiBearerAuth()
export class PrinterSettingsController {
  constructor(
    private readonly printerSettingsService: PrinterSettingsService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear configuración de impresora' })
  @ApiResponse({ status: 201, description: 'Impresora creada' })
  create(@Body() createDto: CreatePrinterSettingsDto) {
    return this.printerSettingsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las impresoras del tenant' })
  @ApiResponse({ status: 200, description: 'Lista de impresoras' })
  findAll() {
    return this.printerSettingsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener impresora por ID' })
  @ApiResponse({ status: 200, description: 'Impresora encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.printerSettingsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Actualizar impresora' })
  @ApiResponse({ status: 200, description: 'Impresora actualizada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePrinterSettingsDto,
  ) {
    return this.printerSettingsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar impresora' })
  @ApiResponse({ status: 204, description: 'Impresora eliminada' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.printerSettingsService.remove(id);
  }

  @Patch(':id/default')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Establecer impresora como predeterminada' })
  @ApiResponse({ status: 200, description: 'Impresora establecida como predeterminada' })
  setDefault(@Param('id', ParseUUIDPipe) id: string) {
    return this.printerSettingsService.setDefault(id);
  }
}
