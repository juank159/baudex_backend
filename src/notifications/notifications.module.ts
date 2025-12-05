import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationJobsService } from './jobs/notification-jobs.service';
import { Notification } from './entities/notification.entity';

// Importar entidades necesarias para los jobs
import { Organization } from '../organizations/entities/organization.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { Invoice } from '../invoices/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      Organization,
      Product,
      InventoryBatch,
      Invoice,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationJobsService],
  exports: [NotificationsService], // Exportar para usar en otros módulos
})
export class NotificationsModule {}
