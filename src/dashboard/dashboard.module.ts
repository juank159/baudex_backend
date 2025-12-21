// src/modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities needed for ProfitabilityService
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Payment } from '../invoices/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';

// Controladores
import { DashboardSimpleController } from './dashboard-simple.controller';
// import { DashboardController } from './dashboard.controller'; // Deshabilitado temporalmente - usando DashboardSimpleController con desglose

// Services
import { ProfitabilityService } from '../common/services/profitability.service';
import { DashboardService } from './dashboard.service';
import { KpiService } from './kpi.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      Invoice,
      InvoiceItem,
      Payment,
      Expense,
      Customer,
      Product,
      BankAccount,
    ]),
  ],
  controllers: [DashboardSimpleController], // DashboardController deshabilitado temporalmente
  providers: [
    ProfitabilityService,
    DashboardService,
    KpiService,
    ReportsService,
  ],
  exports: [ProfitabilityService, DashboardService, KpiService, ReportsService],
})
export class DashboardModule {}
