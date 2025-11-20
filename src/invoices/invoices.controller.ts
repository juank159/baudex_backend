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
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { AddPaymentDto } from './dto/payment.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequireSubscription } from '../common/decorators/subscription-action.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('invoices')
@UseGuards(AuthGuard())
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

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
}
