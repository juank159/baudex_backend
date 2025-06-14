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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@Controller('customers')
@UseGuards(AuthGuard())
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findAll(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getStats() {
    return this.customersService.getStats();
  }

  @Get('search')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  search(@Query('q') searchTerm: string, @Query('limit') limit: number = 10) {
    return this.customersService.search(searchTerm, limit);
  }

  @Get('document/:documentType/:documentNumber')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findByDocument(
    @Param('documentType') documentType: string,
    @Param('documentNumber') documentNumber: string,
  ) {
    return this.customersService.findByDocument(documentType, documentNumber);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateCustomerStatusDto,
  ) {
    return this.customersService.updateStatus(id, updateStatusDto.status);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.softDelete(id);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.restore(id);
  }

  // src/modules/customers/customers.controller.ts - ENDPOINTS ADICIONALES
  // Agregar estos endpoints al CustomersController existente:

  // 🆕 ENDPOINTS RELACIONADOS CON FACTURAS

  @Get('with-overdue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getCustomersWithOverdueInvoices() {
    return this.customersService.getCustomersWithOverdueInvoices();
  }

  @Get('top-customers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getTopCustomers(@Query('limit') limit: number = 10) {
    return this.customersService.getTopCustomers(limit);
  }

  @Get('stats-with-invoices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getStatsWithInvoices() {
    return this.customersService.getStatsWithInvoices();
  }

  @Get(':id/with-invoices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  findOneWithInvoices(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOneWithInvoices(id);
  }

  @Get(':id/invoices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getCustomerInvoices(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.getCustomerInvoices(id, status, limit);
  }

  @Get(':id/financial-summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getCustomerFinancialSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.getCustomerFinancialSummary(id);
  }

  @Post(':id/can-purchase')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  canMakePurchase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount: number,
  ) {
    return this.customersService.canMakePurchase(id, amount);
  }

  @Post(':id/update-stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  updateCustomerStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.updateCustomerStats(id);
  }
}
