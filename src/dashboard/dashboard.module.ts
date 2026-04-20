import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Payment } from '../invoices/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';

import { DashboardSimpleController } from './dashboard-simple.controller';
import { DashboardService } from './services/dashboard.service';
import { DashboardActivityService } from './services/dashboard-activity.service';
import { ProfitabilityService } from '../common/services/profitability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Sale y SaleItem son requeridos por ProfitabilityService (inyección en constructor).
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
  controllers: [DashboardSimpleController],
  providers: [DashboardService, DashboardActivityService, ProfitabilityService],
  exports: [DashboardService, ProfitabilityService],
})
export class DashboardModule {}
