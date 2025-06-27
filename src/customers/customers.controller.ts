// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Patch,
//   Param,
//   Delete,
//   Query,
//   UseGuards,
//   ParseUUIDPipe,
//   HttpCode,
//   HttpStatus,
// } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import { CustomersService } from './customers.service';
// import { CreateCustomerDto } from './dto/create-customer.dto';
// import { UpdateCustomerDto } from './dto/update-customer.dto';
// import { CustomerQueryDto } from './dto/customer-query.dto';
// import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { UserRole } from '../users/entities/user.entity';

// @Controller('customers')
// @UseGuards(AuthGuard())
// export class CustomersController {
//   constructor(private readonly customersService: CustomersService) {}

//   @Post()
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   @HttpCode(HttpStatus.CREATED)
//   create(@Body() createCustomerDto: CreateCustomerDto) {
//     return this.customersService.create(createCustomerDto);
//   }

//   @Get()
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   findAll(@Query() query: CustomerQueryDto) {
//     return this.customersService.findAll(query);
//   }

//   @Get('stats')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   getStats() {
//     return this.customersService.getStats();
//   }

//   @Get('search')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   search(@Query('q') searchTerm: string, @Query('limit') limit: number = 10) {
//     return this.customersService.search(searchTerm, limit);
//   }

//   @Get('check-email')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   async checkEmailAvailability(
//     @Query('email') email: string,
//     @Query('excludeId') excludeId?: string,
//   ) {
//     try {
//       console.log(
//         `🔍 [EMAIL VALIDATION] Checking email: "${email}", excludeId: "${excludeId}"`,
//       );

//       // Validar que el email esté presente
//       if (!email) {
//         console.log('❌ [EMAIL VALIDATION] Email is missing');
//         return {
//           success: false,
//           available: false,
//           message: 'Email es requerido',
//         };
//       }

//       // Buscar cliente existente con ese email
//       const existingCustomer =
//         await this.customersService.findByEmailForValidation(email, excludeId);

//       const isAvailable = !existingCustomer;

//       console.log(
//         `✅ [EMAIL VALIDATION] Email "${email}" is ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`,
//       );

//       return {
//         success: true,
//         available: isAvailable,
//         message: existingCustomer ? 'Email ya está en uso' : 'Email disponible',
//       };
//     } catch (error) {
//       console.error(
//         '💥 [EMAIL VALIDATION] Error checking email availability:',
//         error,
//       );
//       return {
//         success: false,
//         available: false,
//         message: 'Error al verificar email',
//       };
//     }
//   }

//   @Get('check-document')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   async checkDocumentAvailability(
//     @Query('documentType') documentType: string,
//     @Query('documentNumber') documentNumber: string,
//     @Query('excludeId') excludeId?: string,
//   ) {
//     try {
//       console.log(
//         `🔍 [DOCUMENT VALIDATION] Checking document: "${documentType}:${documentNumber}", excludeId: "${excludeId}"`,
//       );

//       // Validar que los parámetros estén presentes
//       if (!documentType || !documentNumber) {
//         console.log(
//           '❌ [DOCUMENT VALIDATION] DocumentType or documentNumber is missing',
//         );
//         return {
//           success: false,
//           available: false,
//           message: 'Tipo y número de documento son requeridos',
//         };
//       }

//       // Buscar cliente existente con ese documento
//       const existingCustomer =
//         await this.customersService.findByDocumentForValidation(
//           documentType,
//           documentNumber,
//           excludeId,
//         );

//       const isAvailable = !existingCustomer;

//       console.log(
//         `✅ [DOCUMENT VALIDATION] Document "${documentType}:${documentNumber}" is ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`,
//       );

//       return {
//         success: true,
//         available: isAvailable,
//         message: existingCustomer
//           ? 'Documento ya está en uso'
//           : 'Documento disponible',
//       };
//     } catch (error) {
//       console.error(
//         '💥 [DOCUMENT VALIDATION] Error checking document availability:',
//         error,
//       );
//       return {
//         success: false,
//         available: false,
//         message: 'Error al verificar documento',
//       };
//     }
//   }

//   @Get('document/:documentType/:documentNumber')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   findByDocument(
//     @Param('documentType') documentType: string,
//     @Param('documentNumber') documentNumber: string,
//   ) {
//     return this.customersService.findByDocument(documentType, documentNumber);
//   }

//   @Get(':id')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   findOne(@Param('id', ParseUUIDPipe) id: string) {
//     return this.customersService.findOne(id);
//   }

//   @Patch(':id')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   update(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body() updateCustomerDto: UpdateCustomerDto,
//   ) {
//     return this.customersService.update(id, updateCustomerDto);
//   }

//   @Patch(':id/status')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   updateStatus(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body() updateStatusDto: UpdateCustomerStatusDto,
//   ) {
//     return this.customersService.updateStatus(id, updateStatusDto.status);
//   }

//   @Delete(':id')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   @HttpCode(HttpStatus.OK)
//   remove(@Param('id', ParseUUIDPipe) id: string) {
//     return this.customersService.softDelete(id);
//   }

//   @Patch(':id/restore')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   restore(@Param('id', ParseUUIDPipe) id: string) {
//     return this.customersService.restore(id);
//   }

//   // ==================== ENDPOINTS RELACIONADOS CON FACTURAS ====================

//   @Get('with-overdue')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   getCustomersWithOverdueInvoices() {
//     return this.customersService.getCustomersWithOverdueInvoices();
//   }

//   @Get('top-customers')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   getTopCustomers(@Query('limit') limit: number = 10) {
//     return this.customersService.getTopCustomers(limit);
//   }

//   @Get('stats-with-invoices')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   getStatsWithInvoices() {
//     return this.customersService.getStatsWithInvoices();
//   }

//   @Get(':id/with-invoices')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   findOneWithInvoices(@Param('id', ParseUUIDPipe) id: string) {
//     return this.customersService.findOneWithInvoices(id);
//   }

//   @Get(':id/invoices')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   getCustomerInvoices(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Query('status') status?: string,
//     @Query('limit') limit?: number,
//   ) {
//     return this.customersService.getCustomerInvoices(id, status, limit);
//   }

//   @Get(':id/financial-summary')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   getCustomerFinancialSummary(@Param('id', ParseUUIDPipe) id: string) {
//     return this.customersService.getCustomerFinancialSummary(id);
//   }

//   @Post(':id/can-purchase')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   @HttpCode(HttpStatus.OK)
//   canMakePurchase(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body('amount') amount: number,
//   ) {
//     return this.customersService.canMakePurchase(id, amount);
//   }

//   @Post(':id/update-stats')
//   @UseGuards(RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   @HttpCode(HttpStatus.OK)
//   updateCustomerStats(@Param('id', ParseUUIDPipe) id: string) {
//     return this.customersService.updateCustomerStats(id);
//   }
// }

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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getStats() {
    return this.customersService.getStats();
  }

  @Get('search')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  search(@Query('q') searchTerm: string, @Query('limit') limit: number = 10) {
    return this.customersService.search(searchTerm, limit);
  }

  @Get('check-email')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async checkEmailAvailability(
    @Query('email') email: string,
    @Query('excludeId') excludeId?: string,
  ) {
    try {
      console.log(
        `🔍 [EMAIL VALIDATION] Checking email: "${email}", excludeId: "${excludeId}"`,
      );

      if (!email) {
        console.log('❌ [EMAIL VALIDATION] Email is missing');
        return {
          success: false,
          available: false,
          message: 'Email es requerido',
        };
      }

      const existingCustomer =
        await this.customersService.findByEmailForValidation(email, excludeId);

      const isAvailable = !existingCustomer;

      console.log(
        `✅ [EMAIL VALIDATION] Email "${email}" is ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`,
      );

      return {
        success: true,
        available: isAvailable,
        message: existingCustomer ? 'Email ya está en uso' : 'Email disponible',
      };
    } catch (error) {
      console.error(
        '💥 [EMAIL VALIDATION] Error checking email availability:',
        error,
      );
      return {
        success: false,
        available: false,
        message: 'Error al verificar email',
      };
    }
  }

  @Get('check-document')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async checkDocumentAvailability(
    @Query('documentType') documentType: string,
    @Query('documentNumber') documentNumber: string,
    @Query('excludeId') excludeId?: string,
  ) {
    try {
      console.log(
        `🔍 [DOCUMENT VALIDATION] Checking document: "${documentType}:${documentNumber}", excludeId: "${excludeId}"`,
      );

      if (!documentType || !documentNumber) {
        console.log(
          '❌ [DOCUMENT VALIDATION] DocumentType or documentNumber is missing',
        );
        return {
          success: false,
          available: false,
          message: 'Tipo y número de documento son requeridos',
        };
      }

      const existingCustomer =
        await this.customersService.findByDocumentForValidation(
          documentType,
          documentNumber,
          excludeId,
        );

      const isAvailable = !existingCustomer;

      console.log(
        `✅ [DOCUMENT VALIDATION] Document "${documentType}:${documentNumber}" is ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`,
      );

      return {
        success: true,
        available: isAvailable,
        message: existingCustomer
          ? 'Documento ya está en uso'
          : 'Documento disponible',
      };
    } catch (error) {
      console.error(
        '💥 [DOCUMENT VALIDATION] Error checking document availability:',
        error,
      );
      return {
        success: false,
        available: false,
        message: 'Error al verificar documento',
      };
    }
  }

  // ✅ CAMBIO CRÍTICO: Mover estas rutas ANTES de las rutas con parámetros dinámicos
  @Get('with-overdue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getCustomersWithOverdueInvoices() {
    return this.customersService.getCustomersWithOverdueInvoices();
  }

  @Get('top-customers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getTopCustomers(@Query('limit') limit: number = 10) {
    return this.customersService.getTopCustomers(limit);
  }

  @Get('stats-with-invoices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getStatsWithInvoices() {
    return this.customersService.getStatsWithInvoices();
  }

  // ✅ RUTAS CON PARÁMETROS DINÁMICOS AL FINAL
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  getCustomerFinancialSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.getCustomerFinancialSummary(id);
  }

  @Get('default-customer/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async getDefaultCustomer(@Param('id', ParseUUIDPipe) id: string) {
    try {
      console.log(`🔍 [DEFAULT CUSTOMER] Buscando cliente final con ID: ${id}`);

      const customer = await this.customersService.findOne(id);

      console.log(
        `✅ [DEFAULT CUSTOMER] Cliente final encontrado: ${customer.displayName}`,
      );

      return {
        success: true,
        data: customer,
        message: 'Cliente final obtenido exitosamente',
      };
    } catch (error) {
      console.error('❌ [DEFAULT CUSTOMER] Error:', error.message);

      return {
        success: false,
        data: null,
        message: 'Cliente final no encontrado',
      };
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateCustomerStatusDto,
  ) {
    return this.customersService.updateStatus(id, updateStatusDto.status);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.softDelete(id);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.restore(id);
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  updateCustomerStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.updateCustomerStats(id);
  }
}
