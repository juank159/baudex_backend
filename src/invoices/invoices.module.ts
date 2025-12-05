// import { Module, forwardRef } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { InvoicesService } from './invoices.service';
// import { InvoicesController } from './invoices.controller';
// import { Invoice } from './entities/invoice.entity';
// import { InvoiceItem } from './entities/invoice-item.entity';
// import { AuthModule } from '../auth/auth.module';
// import { CustomersModule } from '../customers/customers.module';
// import { ProductModule } from 'src/products/products.module';

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([Invoice, InvoiceItem]),
//     forwardRef(() => AuthModule),
//     forwardRef(() => CustomersModule),
//     forwardRef(() => ProductModule),
//   ],
//   controllers: [InvoicesController],
//   providers: [InvoicesService],
//   exports: [InvoicesService, TypeOrmModule],
// })
// export class InvoicesModule {}

// src/invoices/invoices.module.ts - CORREGIDO

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { ProductModule } from 'src/products/products.module';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomerCreditsModule } from '../customer-credits/customer-credits.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Warehouse, Organization]),
    BankAccountsModule, // 🏦 Módulo de cuentas bancarias
    forwardRef(() => AuthModule),
    forwardRef(() => CustomersModule),
    // ✅ IMPORTANTE: NO usar forwardRef para ProductModule
    // porque necesitamos el TemporaryProductService
    ProductModule, // ✅ CAMBIAR ESTO - sin forwardRef
    CommonModule,
    UsersModule, // Importar UsersModule para UserPreferencesService
    forwardRef(() => InventoryModule), // Para evitar dependencia circular
    NotificationsModule, // 🔔 Módulo de notificaciones
    forwardRef(() => CustomerCreditsModule), // 💳 Módulo de créditos de clientes
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService],
  exports: [InvoicesService, InvoicePdfService, TypeOrmModule],
})
export class InvoicesModule {}
