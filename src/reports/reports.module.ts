import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { Category } from '../categories/entities/category.entity';
import { ProfitabilityReportService } from './services/profitability-report.service';
import { InventoryValuationReportService } from './services/inventory-valuation-report.service';
import { KardexReportService } from './services/kardex-report.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      Product,
      InventoryMovement,
      InventoryBatch,
      Category,
    ]),
  ],
  controllers: [ReportsController],
  providers: [
    ProfitabilityReportService,
    InventoryValuationReportService,
    KardexReportService,
  ],
  exports: [
    ProfitabilityReportService,
    InventoryValuationReportService,
    KardexReportService,
  ],
})
export class ReportsModule {}
