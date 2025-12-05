// src/credit-notes/credit-notes.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CreditNotesService } from './services/credit-notes.service';
import { CreditNotePdfService } from './services/credit-note-pdf.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { UpdateCreditNoteDto } from './dto/update-credit-note.dto';
import { QueryCreditNotesDto } from './dto/query-credit-notes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrganizationsService } from '../organizations/organizations.service';

/**
 * Controlador de Notas de Crédito
 *
 * Endpoints REST para gestionar notas de crédito:
 * - Crear, consultar, actualizar, eliminar
 * - Confirmar (aplicar crédito)
 * - Cancelar
 * - Descargar PDF
 */
@ApiTags('Credit Notes')
@ApiBearerAuth()
@Controller('credit-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CreditNotesController {
  constructor(
    private readonly creditNotesService: CreditNotesService,
    private readonly creditNotePdfService: CreditNotePdfService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Crear una nota de crédito
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Crear nota de crédito',
    description:
      'Crea una nueva nota de crédito para una factura. Puede ser completa (FULL) o parcial (PARTIAL).',
  })
  @ApiResponse({
    status: 201,
    description: 'Nota de crédito creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o factura no puede recibir notas de crédito',
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  async create(
    @Body() createCreditNoteDto: CreateCreditNoteDto,
    @Req() req: any,
  ) {
    const userId = req.user.id; // req.user es el objeto User completo, no un payload
    return this.creditNotesService.create(createCreditNoteDto, userId);
  }

  /**
   * Obtener todas las notas de crédito con filtros
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Listar notas de crédito',
    description:
      'Obtiene todas las notas de crédito con opciones de filtrado, búsqueda y paginación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de notas de crédito obtenida exitosamente',
  })
  async findAll(@Query() queryDto: QueryCreditNotesDto) {
    return this.creditNotesService.findAll(queryDto);
  }

  /**
   * Obtener nota de crédito por ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Obtener nota de crédito por ID',
    description: 'Obtiene los detalles completos de una nota de crédito específica.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la nota de crédito',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Nota de crédito encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Nota de crédito no encontrada',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditNotesService.findOne(id);
  }

  /**
   * Actualizar nota de crédito (solo en DRAFT)
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Actualizar nota de crédito',
    description: 'Actualiza una nota de crédito. Solo se pueden actualizar notas en estado DRAFT.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la nota de crédito',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Nota de crédito actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden actualizar notas en estado DRAFT',
  })
  @ApiResponse({
    status: 404,
    description: 'Nota de crédito no encontrada',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCreditNoteDto: UpdateCreditNoteDto,
  ) {
    return this.creditNotesService.update(id, updateCreditNoteDto);
  }

  /**
   * Confirmar nota de crédito (aplicar crédito)
   */
  @Post(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar nota de crédito',
    description:
      'Confirma la nota de crédito y aplica el crédito al balance del cliente. También restaura el inventario si está configurado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la nota de crédito',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Nota de crédito confirmada y crédito aplicado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden confirmar notas en estado DRAFT',
  })
  @ApiResponse({
    status: 404,
    description: 'Nota de crédito no encontrada',
  })
  async confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user.id; // req.user es el objeto User completo, no un payload
    return this.creditNotesService.confirm(id, userId);
  }

  /**
   * Cancelar nota de crédito
   */
  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar nota de crédito',
    description: 'Cancela una nota de crédito. Solo se pueden cancelar notas en estado DRAFT.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la nota de crédito',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Nota de crédito cancelada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden cancelar notas en estado DRAFT',
  })
  @ApiResponse({
    status: 404,
    description: 'Nota de crédito no encontrada',
  })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditNotesService.cancel(id);
  }

  /**
   * Eliminar nota de crédito
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar nota de crédito',
    description:
      'Elimina una nota de crédito (soft delete). Solo se pueden eliminar notas en estado DRAFT.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la nota de crédito',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Nota de crédito eliminada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden eliminar notas en estado DRAFT',
  })
  @ApiResponse({
    status: 404,
    description: 'Nota de crédito no encontrada',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.creditNotesService.remove(id);
  }

  /**
   * Obtener notas de crédito de una factura específica
   */
  @Get('invoice/:invoiceId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Obtener notas de crédito por factura',
    description:
      'Obtiene todas las notas de crédito asociadas a una factura específica.',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'ID de la factura',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de notas de crédito obtenida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  async findByInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.creditNotesService.findByInvoice(invoiceId);
  }

  /**
   * Descargar PDF de nota de crédito
   */
  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Descargar PDF de nota de crédito',
    description: 'Genera y descarga el PDF de una nota de crédito específica.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la nota de crédito',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': {},
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nota de crédito no encontrada',
  })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // Obtener la nota de crédito con todas sus relaciones
    const creditNote = await this.creditNotesService.findOne(id);
    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    // Obtener la organización del usuario
    const organizationId = req.user.organizationId;
    const organization = await this.organizationsService.findById(organizationId);

    // Generar el PDF
    const pdfBuffer = await this.creditNotePdfService.generateCreditNotePdf(
      creditNote,
      organization,
    );

    // Configurar headers para descarga
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="nota-credito-${creditNote.number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    // Enviar el PDF
    res.end(pdfBuffer);
  }

  /**
   * Obtener monto acreditable restante de una factura
   */
  @Get('invoice/:invoiceId/remaining-creditable')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Obtener monto acreditable restante',
    description:
      'Calcula cuánto crédito aún se puede aplicar a una factura (total factura - suma de notas de crédito confirmadas).',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'ID de la factura',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Monto calculado exitosamente',
    schema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', format: 'uuid' },
        remainingCreditableAmount: { type: 'number', example: 1500000 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  async getRemainingCreditableAmount(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    const remainingCreditableAmount =
      await this.creditNotesService.getRemainingCreditableAmount(invoiceId);

    return {
      invoiceId,
      remainingCreditableAmount,
    };
  }

  /**
   * Obtener cantidades disponibles por item para crear notas de crédito
   */
  @Get('invoice/:invoiceId/available-quantities')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Obtener cantidades disponibles para notas de crédito',
    description:
      'Obtiene información detallada de las cantidades disponibles por item de factura, ' +
      'considerando notas de crédito confirmadas y en borrador. Útil para el formulario de creación.',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'ID de la factura',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Cantidades disponibles calculadas exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  async getAvailableQuantitiesForCreditNote(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.creditNotesService.getAvailableQuantitiesForCreditNote(invoiceId);
  }
}
