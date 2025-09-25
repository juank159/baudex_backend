// src/modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities needed for ProfitabilityService
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';

// Controladores
import { DashboardSimpleController } from './dashboard-simple.controller';

// Services
import { ProfitabilityService } from '../common/services/profitability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Invoice, InvoiceItem]),
  ],
  controllers: [DashboardSimpleController],
  providers: [
    ProfitabilityService,
  ],
  exports: [ProfitabilityService],
})
export class DashboardModule {}
