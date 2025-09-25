import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InventoryBatchMovement } from './entities/inventory-batch-movement.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { ProductPurchaseHistory } from './entities/product-purchase-history.entity';
import { Product } from '../products/entities/product.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { InventoryService } from './services/inventory.service';
import { PurchaseOrdersController } from './controllers/purchase-orders.controller';
import { InventoryController } from './controllers/inventory.controller';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { KardexReportService } from '../reports/services/kardex-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryMovement,
      InventoryBatch,
      InventoryBatchMovement,
      PurchaseOrder,
      PurchaseOrderItem,
      ProductPurchaseHistory,
      Product,
      Supplier,
    ]),
  ],
  controllers: [PurchaseOrdersController, InventoryController],
  providers: [InventoryService, PurchaseOrdersService, KardexReportService],
  exports: [InventoryService, PurchaseOrdersService, KardexReportService],
})
export class InventoryModule {}
