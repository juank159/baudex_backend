// src/modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entidades
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Product } from 'src/products/entities/product.entity';

// Controladores
import { DashboardController } from './dashboard.controller';

// Servicios
import { ReportsService } from './reports.service';
import { DashboardService } from './dashboard.service';
import { KpiService } from './kpi.service';

// Módulos relacionados
import { InvoicesModule } from 'src/invoices/invoices.module';
import { ExpensesModule } from 'src/expenses/expenses.module';
import { CustomersModule } from 'src/customers/customers.module';
import { ProductModule } from 'src/products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Expense, Customer, Product]),
    // Importar módulos que exportan los servicios que necesitamos
    InvoicesModule,
    ExpensesModule,
    CustomersModule,
    ProductModule,
  ],
  controllers: [DashboardController],
  providers: [
    // Solo los servicios propios del dashboard
    DashboardService,
    KpiService,
    ReportsService,
  ],
  exports: [DashboardService, KpiService, ReportsService],
})
export class DashboardModule {}
