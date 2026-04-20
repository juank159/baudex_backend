import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, LessThanOrEqual } from 'typeorm';
import { NotificationsService } from '../notifications.service';
import {
  NotificationType,
  NotificationSeverity,
} from '../entities/notification.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryBatch } from '../../inventory/entities/inventory-batch.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { getHourInTimezone } from '../../common/utils/timezone-range.util';

/**
 * 🕐 NOTIFICATION JOBS SERVICE
 *
 * Los chequeos user-facing corren cada hora UTC y filtran internamente por
 * hora local de cada organización — así un tenant en Caracas recibe su
 * notificación a las 8am hora Caracas, no a las 8am Bogotá.
 *
 * Los jobs de limpieza (housekeeping de tablas) siguen corriendo una vez
 * al día en UTC sin importar la TZ de cada tenant.
 */
@Injectable()
export class NotificationJobsService {
  private readonly logger = new Logger(NotificationJobsService.name);

  constructor(
    private readonly notificationsService: NotificationsService,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(InventoryBatch)
    private readonly batchRepository: Repository<InventoryBatch>,

    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  /**
   * 🔴 JOB 1: PRODUCTOS POR VENCER (FEFO)
   * Se dispara cada hora UTC. Procesa cada organización solo cuando en su
   * timezone local son las 8:00 AM.
   */
  private static readonly EXPIRING_PRODUCTS_HOUR_LOCAL = 8;

  @Cron('0 * * * *', { name: 'check-expiring-products' })
  async checkExpiringProducts() {
    try {
      const organizations = await this.organizationRepository
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.users', 'user')
        .where('org.isActive = :isActive', { isActive: true })
        .getMany();

      const dueNow = organizations.filter(
        (o) =>
          getHourInTimezone(o.timezone || 'UTC') ===
          NotificationJobsService.EXPIRING_PRODUCTS_HOUR_LOCAL,
      );
      if (dueNow.length === 0) return;

      this.logger.log(
        `🔍 [CRON] Productos por vencer — ${dueNow.length}/${organizations.length} orgs en hora 8am local`,
      );

      let totalNotifications = 0;

      for (const org of dueNow) {
        // Obtener productos FEFO con lotes próximos a vencer (próximos 7 días)
        const expiringDate = new Date();
        expiringDate.setDate(expiringDate.getDate() + 7);

        const expiringBatches = await this.batchRepository
          .createQueryBuilder('batch')
          .leftJoinAndSelect('batch.product', 'product')
          .where('batch.organizationId = :orgId', { orgId: org.id })
          .andWhere('batch.status = :status', { status: 'active' })
          .andWhere('batch.currentQuantity > 0')
          .andWhere('batch.expirationDate IS NOT NULL')
          .andWhere('batch.expirationDate <= :expiringDate', { expiringDate })
          .andWhere('batch.expirationDate >= :today', { today: new Date() })
          .orderBy('batch.expirationDate', 'ASC')
          .getMany();

        if (expiringBatches.length === 0) {
          this.logger.debug(
            `✅ Organización ${org.name}: Sin productos por vencer`,
          );
          continue;
        }

        this.logger.log(
          `⚠️  Organización ${org.name}: ${expiringBatches.length} lotes por vencer`,
        );

        // Crear notificación por cada lote
        for (const batch of expiringBatches) {
          const daysUntilExpiry = Math.ceil(
            (batch.expirationDate.getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          );

          // Determinar severidad según días restantes
          let severity = NotificationSeverity.INFO;
          if (daysUntilExpiry <= 2) {
            severity = NotificationSeverity.CRITICAL;
          } else if (daysUntilExpiry <= 4) {
            severity = NotificationSeverity.WARNING;
          }

          // Obtener primer usuario de la organización para notificar
          const userId = org.users && org.users.length > 0 ? org.users[0].id : org.id;

          await this.notificationsService.create({
            organizationId: org.id,
            userId, // Notificar al primer usuario
            type: NotificationType.EXPIRING_PRODUCT,
            severity,
            title: `🚨 Producto por vencer en ${daysUntilExpiry} día${daysUntilExpiry > 1 ? 's' : ''}`,
            message: `El producto "${batch.product.name}" (Lote: ${batch.batchNumber}) vence el ${batch.expirationDate.toLocaleDateString('es-CO')}. Stock actual: ${batch.currentQuantity} unidades.`,
            metadata: {
              productId: batch.product.id,
              productName: batch.product.name,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              quantity: batch.currentQuantity,
              daysUntilExpiry,
              actionUrl: `/inventory/batches/${batch.id}`,
              actionLabel: 'Ver Lote',
            },
            expiresAt: batch.expirationDate, // Auto-eliminar después del vencimiento
          });

          totalNotifications++;
        }
      }

      this.logger.log(
        `✅ [CRON] Chequeo de productos por vencer completado. ${totalNotifications} notificaciones creadas.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [CRON] Error en chequeo de productos por vencer: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 🔴 JOB 2: STOCK BAJO
   * Se dispara cada hora UTC; procesa solo orgs donde son las 9:00 locales.
   */
  private static readonly LOW_STOCK_HOUR_LOCAL = 9;

  @Cron('0 * * * *', { name: 'check-low-stock' })
  async checkLowStock() {
    try {
      const organizations = await this.organizationRepository
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.users', 'user')
        .where('org.isActive = :isActive', { isActive: true })
        .getMany();

      const dueNow = organizations.filter(
        (o) =>
          getHourInTimezone(o.timezone || 'UTC') ===
          NotificationJobsService.LOW_STOCK_HOUR_LOCAL,
      );
      if (dueNow.length === 0) return;

      this.logger.log(
        `🔍 [CRON] Stock bajo — ${dueNow.length}/${organizations.length} orgs en hora 9am local`,
      );

      let totalNotifications = 0;

      for (const org of dueNow) {
        // Obtener productos con stock <= minStock para esta organización
        const lowStockProducts = await this.productRepository
          .createQueryBuilder('product')
          .where('product.organizationId = :orgId', { orgId: org.id })
          .andWhere('product.stock <= product.minStock')
          .andWhere('product.stock > 0')
          .andWhere('product.deletedAt IS NULL')
          .getMany();

        if (lowStockProducts.length === 0) {
          this.logger.debug(
            `✅ Organización ${org.name}: Sin productos con stock bajo`,
          );
          continue;
        }

        this.logger.log(
          `⚠️  Organización ${org.name}: ${lowStockProducts.length} productos con stock bajo`,
        );

        // Obtener primer usuario de la organización para notificar
        const userId = org.users && org.users.length > 0 ? org.users[0].id : org.id;

        // Crear notificación por cada producto
        for (const product of lowStockProducts) {
          const deficit = product.minStock - product.stock;

          await this.notificationsService.create({
            organizationId: org.id,
            userId,
            type: NotificationType.LOW_STOCK,
            severity: NotificationSeverity.WARNING,
            title: `📉 Stock bajo: ${product.name}`,
            message: `El producto tiene ${product.stock} unidad${product.stock > 1 ? 'es' : ''} (mínimo: ${product.minStock}). Déficit: ${deficit} unidades. Se recomienda generar orden de compra.`,
            metadata: {
              productId: product.id,
              productName: product.name,
              quantity: product.stock,
              actionUrl: `/products/${product.id}`,
              actionLabel: 'Ver Producto',
            },
          });

          totalNotifications++;
        }
      }

      this.logger.log(
        `✅ [CRON] Chequeo de stock bajo completado. ${totalNotifications} notificaciones creadas.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [CRON] Error en chequeo de stock bajo: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 🔴 JOB 3: FACTURAS VENCIDAS
   * Se dispara cada hora UTC; procesa solo orgs donde son las 10:00 locales.
   */
  private static readonly OVERDUE_INVOICES_HOUR_LOCAL = 10;

  @Cron('0 * * * *', { name: 'check-overdue-invoices' })
  async checkOverdueInvoices() {
    try {
      const organizations = await this.organizationRepository
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.users', 'user')
        .where('org.isActive = :isActive', { isActive: true })
        .getMany();

      const dueNow = organizations.filter(
        (o) =>
          getHourInTimezone(o.timezone || 'UTC') ===
          NotificationJobsService.OVERDUE_INVOICES_HOUR_LOCAL,
      );
      if (dueNow.length === 0) return;
      const orgIds = dueNow.map((o) => o.id);

      // Solo facturas de las orgs que están en hora 10am local ahora.
      const overdueInvoices = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.customer', 'customer')
        .where('invoice.organizationId IN (:...orgIds)', { orgIds })
        .andWhere('invoice.dueDate < :today', { today: new Date() })
        .andWhere('invoice.status IN (:...statuses)', {
          statuses: ['pending', 'overdue'],
        })
        .andWhere('invoice.deletedAt IS NULL')
        .orderBy('invoice.dueDate', 'ASC')
        .getMany();

      this.logger.log(
        `🔍 [CRON] Facturas vencidas — ${dueNow.length}/${organizations.length} orgs a las 10am local; ${overdueInvoices.length} facturas a procesar`,
      );

      let totalNotifications = 0;

      for (const invoice of overdueInvoices) {
        const daysOverdue = Math.floor(
          (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Determinar severidad según días de atraso
        let severity = NotificationSeverity.WARNING;
        if (daysOverdue >= 15) {
          severity = NotificationSeverity.CRITICAL;
        }

        // Obtener userId de la organización
        const orgWithUsers = await this.organizationRepository
          .createQueryBuilder('org')
          .leftJoinAndSelect('org.users', 'user')
          .where('org.id = :orgId', { orgId: invoice.organizationId })
          .getOne();

        const userId =
          orgWithUsers?.users && orgWithUsers.users.length > 0
            ? orgWithUsers.users[0].id
            : invoice.organizationId;

        await this.notificationsService.create({
          organizationId: invoice.organizationId,
          userId,
          type: NotificationType.INVOICE_OVERDUE,
          severity,
          title: `💳 Factura vencida - ${invoice.customer.displayName}`,
          message: `Factura #${invoice.number} lleva ${daysOverdue} día${daysOverdue > 1 ? 's' : ''} de atraso. Monto: $${Number(invoice.total).toLocaleString('es-CO')}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            customerId: invoice.customerId,
            customerName: invoice.customer.displayName,
            amount: Number(invoice.total),
            daysOverdue,
            actionUrl: `/invoices/${invoice.id}`,
            actionLabel: 'Ver Factura',
          },
        });

        totalNotifications++;
      }

      this.logger.log(
        `✅ [CRON] Chequeo de facturas vencidas completado. ${totalNotifications} notificaciones creadas.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [CRON] Error en chequeo de facturas vencidas: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 🧹 JOB 4: LIMPIAR NOTIFICACIONES EXPIRADAS
   * Housekeeping global. Corre a las 2:00 AM UTC independiente del tenant.
   */
  @Cron('0 2 * * *', { name: 'clean-expired-notifications' })
  async cleanExpiredNotifications() {
    this.logger.log('🧹 [CRON] Limpiando notificaciones expiradas...');

    try {
      const count =
        await this.notificationsService.cleanExpiredNotifications();
      this.logger.log(`✅ [CRON] ${count} notificaciones expiradas eliminadas`);
    } catch (error) {
      this.logger.error(
        `❌ [CRON] Error limpiando notificaciones expiradas: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 🧹 JOB 5: LIMPIAR NOTIFICACIONES ANTIGUAS (30+ días)
   * Housekeeping global. Corre domingos a las 3:00 AM UTC.
   */
  @Cron('0 3 * * 0', { name: 'clean-old-notifications' })
  async cleanOldNotifications() {
    this.logger.log('🧹 [CRON] Limpiando notificaciones antiguas (30+ días)...');

    try {
      const count = await this.notificationsService.cleanOldNotifications(30);
      this.logger.log(`✅ [CRON] ${count} notificaciones antiguas eliminadas`);
    } catch (error) {
      this.logger.error(
        `❌ [CRON] Error limpiando notificaciones antiguas: ${error.message}`,
        error.stack,
      );
    }
  }
}
