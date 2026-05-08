// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { TenantMiddleware } from './common/middlewares/tenant.middleware';

import { OrganizationsModule } from './organizations/organizations.module';
import { CategoryModule } from './categories/categories.module';
import { ProductModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { SubscriptionModule } from './common/modules/subscription.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ScheduleModule } from '@nestjs/schedule';
// Nuevos módulos PEPS/FIFO
import { SuppliersModule } from './suppliers/suppliers.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { ReportsModule } from './reports/reports.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CreditNotesModule } from './credit-notes/credit-notes.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { CustomerCreditsModule } from './customer-credits/customer-credits.module';
import { PrinterSettingsModule } from './printer-settings/printer-settings.module';
import { AppMailerModule } from './mailer/mailer.module';

@Module({
  imports: [
    // Configuración global de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Módulo de base de datos separado
    DatabaseModule,

    // Módulo común con servicios utilitarios
    CommonModule,

    // Módulo global de suscripciones (legacy)
    SubscriptionModule,

    // Nuevo módulo de suscripciones
    SubscriptionsModule,

    // Módulo de tareas programadas
    ScheduleModule.forRoot(),

    // Módulos de negocio
    OrganizationsModule, // Nuevo módulo de organizaciones
    UsersModule,
    CategoryModule,
    ProductModule,
    AuthModule,
    CustomersModule,
    InvoicesModule,
    ExpensesModule,
    DashboardModule,

    // Nuevos módulos PEPS/FIFO
    SuppliersModule,
    InventoryModule,
    SalesModule,
    ReportsModule,
    WarehousesModule,
    NotificationsModule,

    // Módulo de Notas de Crédito
    CreditNotesModule,

    // Módulo de Cuentas Bancarias
    BankAccountsModule,

    // Módulo de Caja Registradora
    CashRegisterModule,

    // Módulo de Configuración de Impresoras
    PrinterSettingsModule,

    // Módulo de Email (SMTP)
    AppMailerModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        // Rutas que no requieren tenant
        'health',
        'api/health',
        'api-docs/(.*)',
        '/',
        // Rutas de sistema que pueden manejar múltiples tenants
        'auth/system/(.*)',
        'organizations',
      )
      .forRoutes('*');
  }
}
