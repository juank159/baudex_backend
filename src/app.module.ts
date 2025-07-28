// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { TenantMiddleware } from './common/middlewares/tenant.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrganizationsModule } from './organizations/organizations.module';
import { CategoryModule } from './categories/categories.module';
import { ProductModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { Organization } from './organizations/entities/organization.entity';
import { SubscriptionModule } from './common/modules/subscription.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // Configuración global de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Módulo de base de datos separado
    DatabaseModule,
    
    // TypeORM para el middleware de tenant
    TypeOrmModule.forFeature([Organization]),

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        // Rutas que no requieren tenant
        'health',
        'api-docs/(.*)',
        '/',
        // Rutas de sistema que pueden manejar múltiples tenants
        'auth/system/(.*)',
        'organizations'
      )
      .forRoutes('*');
  }
}
