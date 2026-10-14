// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { TenantDateTimeInterceptor } from './common/interceptors/tenant-datetime.interceptor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { TenantMiddleware } from './common/middlewares/tenant.middleware';
import { TenantClockMiddleware } from './common/middlewares/tenant-clock.middleware';

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
import { SyncModule } from './sync/sync.module';
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
    SyncModule,

    // Módulo de Configuración de Impresoras
    PrinterSettingsModule,

    // Módulo de Email (SMTP)
    AppMailerModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Idempotencia global: una escritura reenviada por la app (cola offline,
    // reintento, doble toque) no se ejecuta dos veces. Ver el interceptor.
    // Zona horaria del negocio: toda hora que llega sin zona se interpreta
    // con la zona configurada del tenant, antes de llegar a cualquier módulo.
    { provide: APP_INTERCEPTOR, useClass: TenantDateTimeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      // TenantClockMiddleware va DESPUÉS de TenantMiddleware: usa el negocio
      // ya resuelto para fijar la zona horaria de toda la petición.
      .apply(TenantMiddleware, TenantClockMiddleware)
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
