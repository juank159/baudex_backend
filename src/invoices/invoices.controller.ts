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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { AddPaymentDto, AddMultiplePaymentsDto } from './dto/payment.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequireSubscription } from '../common/decorators/subscription-action.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organizations/entities/organization.entity';
import { TenantAwareService } from '../common/services/tenant-aware.service';

@Controller('invoices')
@UseGuards(AuthGuard())
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard, SubscriptionGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @RequireSubscription('create_invoice')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createInvoiceDto: CreateInvoiceDto, @GetUser() user: User) {
    return this.invoicesService.create(createInvoiceDto, user.id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getStats() {
    return this.invoicesService.getStats();
  }

  @Get('overdue')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getOverdueInvoices() {
    return this.invoicesService.getOverdueInvoices();
  }

  @Get('number/:number')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findByNumber(@Param('number') number: string) {
    return this.invoicesService.findByNumber(number);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, SubscriptionGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @RequireSubscription('update_invoice')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.confirm(id);
  }

  @Post(':id/generate-missing-payment')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  generateMissingPaymentRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.invoicesService.generateMissingPaymentRecord(id, user.id);
  }

  @Post(':id/payments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() paymentDto: AddPaymentDto,
    @GetUser() user: User,
  ) {
    return this.invoicesService.addPayment(id, paymentDto, user.id);
  }

  /**
   * Agregar múltiples pagos a una factura
   * Permite pagos parciales con diferentes métodos (Ej: $100,000 Nequi + $200,000 Efectivo)
   */
  @Post(':id/payments/multiple')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  addMultiplePayments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() multiPaymentDto: AddMultiplePaymentsDto,
    @GetUser() user: User,
  ) {
    return this.invoicesService.addMultiplePayments(id, multiPaymentDto, user.id);
  }

  /**
   * Aplicar saldo a favor del cliente a una factura
   * Permite usar el saldo a favor del cliente para pagar total o parcialmente
   */
  @Post(':id/apply-balance')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aplicar saldo a favor a una factura' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          minimum: 0.01,
          description: 'Monto a aplicar (opcional, por defecto aplica todo el saldo disponible hasta cubrir la deuda)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Saldo aplicado exitosamente',
    schema: {
      properties: {
        invoice: { type: 'object' },
        balanceUsed: { type: 'number', description: 'Monto del saldo usado' },
        remainingBalance: { type: 'number', description: 'Saldo restante del cliente' },
        remainingDebt: { type: 'number', description: 'Deuda restante de la factura' },
      },
    },
  })
  applyClientBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { amount?: number },
    @GetUser() user: User,
  ) {
    return this.invoicesService.applyClientBalance(id, user.id, dto.amount);
  }

  /**
   * Obtener todos los pagos de una factura
   */
  @Get(':id/payments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.getPaymentsByInvoice(id);
  }

  /**
   * Eliminar un pago específico de una factura
   */
  @Delete(':id/payments/:paymentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  removePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.invoicesService.removePayment(id, paymentId);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.cancel(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.softDelete(id);
  }

  // ✅ NUEVO ENDPOINT: Generar PDF de factura
  @Get(':id/pdf')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    // Obtener factura con todas sus relaciones
    const invoice = await this.invoicesService.findOne(id);

    // Obtener organización del tenant actual
    const tenantId = this.tenantAwareService.getTenantId();
    const organization = await this.organizationRepository.findOne({
      where: { id: tenantId },
    });

    // Generar PDF
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(
      invoice,
      organization,
    );

    // Configurar headers para descarga
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Factura-${invoice.number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    // Enviar PDF
    res.end(pdfBuffer);
  }
}
