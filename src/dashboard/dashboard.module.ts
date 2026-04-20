import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Payment } from '../invoices/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';

import { DashboardSimpleController } from './dashboard-simple.controller';
import { ProfitabilityService } from '../common/services/profitability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
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
  providers: [ProfitabilityService],
  exports: [ProfitabilityService],
})
export class DashboardModule {}
