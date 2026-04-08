import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

/**
 * 🕐 NOTIFICATION JOBS SERVICE
 * Chequeos automáticos programados para generar notificaciones
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
   * Ejecuta: Todos los días a las 8:00 AM
   * Zona horaria: America/Bogota (GMT-5)
   */
  @Cron('0 8 * * *', {
    name: 'check-expiring-products',
    timeZone: 'America/Bogota',
  })
  async checkExpiringProducts() {
    this.logger.log('🔍 [CRON] Iniciando chequeo de productos por vencer...');

    try {
      // Obtener todas las organizaciones activas con primer usuario admin
      const organizations = await this.organizationRepository
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.users', 'user')
        .where('org.isActive = :isActive', { isActive: true })
        .getMany();

      this.logger.log(
        `📊 Revisando ${organizations.length} organizaciones activas`,
      );

      let totalNotifications = 0;

      for (const org of organizations) {
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
   * Ejecuta: Todos los días a las 9:00 AM
   */
  @Cron('0 9 * * *', {
    name: 'check-low-stock',
    timeZone: 'America/Bogota',
  })
  async checkLowStock() {
    this.logger.log('🔍 [CRON] Iniciando chequeo de stock bajo...');

    try {
      // Obtener todas las organizaciones activas con primer usuario admin
      const organizations = await this.organizationRepository
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.users', 'user')
        .where('org.isActive = :isActive', { isActive: true })
        .getMany();

      this.logger.log(
        `📊 Revisando ${organizations.length} organizaciones activas`,
      );

      let totalNotifications = 0;

      for (const org of organizations) {
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
   * Ejecuta: Todos los días a las 10:00 AM
   */
  @Cron('0 10 * * *', {
    name: 'check-overdue-invoices',
    timeZone: 'America/Bogota',
  })
  async checkOverdueInvoices() {
    this.logger.log('🔍 [CRON] Iniciando chequeo de facturas vencidas...');

    try {
      // Obtener facturas vencidas (dueDate < hoy y status != paid)
      const overdueInvoices = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.customer', 'customer')
        .where('invoice.dueDate < :today', { today: new Date() })
        .andWhere('invoice.status IN (:...statuses)', {
          statuses: ['pending', 'overdue'],
        })
        .andWhere('invoice.deletedAt IS NULL')
        .orderBy('invoice.dueDate', 'ASC')
        .getMany();

      this.logger.log(
        `📊 Encontradas ${overdueInvoices.length} facturas vencidas`,
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
   * Ejecuta: Todos los días a las 2:00 AM
   */
  @Cron('0 2 * * *', {
    name: 'clean-expired-notifications',
    timeZone: 'America/Bogota',
  })
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
   * Ejecuta: Todos los domingos a las 3:00 AM
   */
  @Cron('0 3 * * 0', {
    name: 'clean-old-notifications',
    timeZone: 'America/Bogota',
  })
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
