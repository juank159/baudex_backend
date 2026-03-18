import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { ProductPurchaseHistory } from '../entities/product-purchase-history.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Product } from '../../products/entities/product.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import {
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderItemDto,
} from '../dto/update-purchase-order.dto';
import { ReceivePurchaseOrderDto } from '../dto/receive-purchase-order.dto';
import { PurchaseOrderQueryDto } from '../dto/inventory-query.dto';
import { InventoryService } from './inventory.service';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(ProductPurchaseHistory)
    private purchaseHistoryRepository: Repository<ProductPurchaseHistory>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private inventoryService: InventoryService,
    private dataSource: DataSource,
  ) {}

  async create(
    createPurchaseOrderDto: CreatePurchaseOrderDto,
    organizationId: string,
    userId: string,
  ): Promise<PurchaseOrder> {
    const MAX_RETRIES = 5;

    // Verificar proveedor y productos ANTES del loop (no cambian entre intentos)
    const supplier = await this.supplierRepository.findOne({
      where: { id: createPurchaseOrderDto.supplierId, organizationId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    for (const item of createPurchaseOrderDto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, organizationId },
      });
      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }
    }

    const { items: itemsDto, ...orderData } = createPurchaseOrderDto;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Generar número de orden con lock para evitar colisiones
        const orderNumber = await this.generateOrderNumber(
          organizationId,
          queryRunner,
        );

        // Crear la orden de compra
        const purchaseOrder = queryRunner.manager.create(PurchaseOrder, {
          ...orderData,
          orderNumber,
          supplierId: createPurchaseOrderDto.supplierId,
          organizationId,
          createdById: userId,
          orderDate: new Date(),
        });

        const savedOrder = await queryRunner.manager.save(purchaseOrder);

        // Crear items
        const items: PurchaseOrderItem[] = [];

        for (let index = 0; index < itemsDto.length; index++) {
          const itemDto = itemsDto[index];
          const quantity = Number(itemDto.quantity);
          const unitCost = Number(itemDto.unitCost);
          const taxPercentage = Number(itemDto.taxPercentage || 0);
          const subtotal = quantity * unitCost;
          const taxAmount = (subtotal * taxPercentage) / 100;
          const total = subtotal + taxAmount;

          const result = await queryRunner.query(
            `INSERT INTO "purchase_order_items"
             ("lineNumber", "quantity", "unitCost", "subtotal", "taxPercentage", "taxAmount", "total", "receivedQuantity", "notes", "purchaseOrderId", "productId")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              itemDto.lineNumber,
              quantity,
              unitCost,
              subtotal,
              taxPercentage,
              taxAmount,
              total,
              0,
              itemDto.notes || null,
              savedOrder.id,
              itemDto.productId,
            ],
          );

          const insertedItem = await queryRunner.manager.findOne(
            PurchaseOrderItem,
            { where: { id: result[0].id } },
          );
          if (insertedItem) {
            items.push(insertedItem);
          }
        }

        // Calcular totales
        const itemsSubtotal = items.reduce(
          (sum, item) => sum + Number(item.total || 0),
          0,
        );
        savedOrder.subtotal = Number(itemsSubtotal);
        savedOrder.taxAmount = savedOrder.taxPercentage
          ? (Number(itemsSubtotal) * Number(savedOrder.taxPercentage)) / 100
          : 0;
        savedOrder.total =
          Number(savedOrder.subtotal) +
          Number(savedOrder.taxAmount) +
          Number(savedOrder.shippingCost || 0);

        await queryRunner.manager.update(
          PurchaseOrder,
          { id: savedOrder.id },
          {
            subtotal: savedOrder.subtotal,
            taxAmount: savedOrder.taxAmount,
            total: savedOrder.total,
          },
        );

        await queryRunner.commitTransaction();

        const finalOrder = await this.findOne(savedOrder.id, organizationId);
        return finalOrder;
      } catch (error) {
        await queryRunner.rollbackTransaction();

        const errCode = error?.driverError?.code || error?.code;
        const errConstraint =
          error?.driverError?.constraint || error?.constraint;

        if (
          errCode === '23505' &&
          (errConstraint === 'purchase_orders_poNumber_key' ||
            errConstraint === 'UQ_purchase_orders_org_poNumber') &&
          attempt < MAX_RETRIES - 1
        ) {
          this.logger.warn(
            `poNumber duplicado (intento ${attempt + 1}/${MAX_RETRIES}), reintentando...`,
          );
          continue;
        }

        throw error;
      } finally {
        if (!queryRunner.isReleased) {
          await queryRunner.release();
        }
      }
    }

    throw new BadRequestException(
      'No se pudo generar un número de orden único después de varios intentos',
    );
  }

  async findAll(
    query: PurchaseOrderQueryDto,
    organizationId: string,
  ): Promise<{ data: PurchaseOrder[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      supplierId,
      status,
      startDate,
      endDate,
      search,
    } = query;

    // Solo cargar supplier y createdBy para el listado (NO items ni products)
    const queryBuilder = this.purchaseOrderRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.createdBy', 'createdBy')
      .loadRelationCountAndMap('po.itemCount', 'po.items')
      .where('po.organizationId = :organizationId', { organizationId });

    if (supplierId) {
      queryBuilder.andWhere('po.supplierId = :supplierId', { supplierId });
    }

    if (status) {
      queryBuilder.andWhere('po.status = :status', { status });
    }

    if (startDate) {
      queryBuilder.andWhere('po.orderDate >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('po.orderDate <= :endDate', { endDate });
    }

    if (search) {
      queryBuilder.andWhere(
        '(po.orderNumber ILIKE :search OR po.notes ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('po.orderDate', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, organizationId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('po.createdBy', 'createdBy')
      .leftJoinAndSelect('po.approvedBy', 'approvedBy')
      .leftJoinAndSelect('po.batches', 'batches')
      .where('po.id = :id', { id })
      .andWhere('po.organizationId = :organizationId', { organizationId })
      .getOne();

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    this.logger.log(
      `🔍 DEBUG purchaseOrder.items length: ${purchaseOrder.items.length}`,
    );
    purchaseOrder.items.forEach((item, index) => {
      this.logger.log(`🔍 DEBUG Item ${index}:`);
      this.logger.log(`   - id: ${item.id}`);
      this.logger.log(`   - productId: ${item.productId}`);
      this.logger.log(
        `   - product: ${item.product ? JSON.stringify({ id: item.product.id, name: item.product.name }) : 'NULL'}`,
      );
    });

    return purchaseOrder;
  }

  async update(
    id: string,
    updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    organizationId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, organizationId);

    if (!purchaseOrder.isEditable) {
      throw new BadRequestException(
        'Purchase order cannot be modified in current status',
      );
    }

    // Separar items del resto de datos para actualizar
    const { items, ...purchaseOrderData } = updatePurchaseOrderDto;

    // Actualizar datos principales de la orden
    await this.purchaseOrderRepository.update(
      { id, organizationId },
      { ...purchaseOrderData, updatedAt: new Date() },
    );

    // Si hay items, manejarlos por separado
    if (items && items.length > 0) {
      await this.updatePurchaseOrderItems(id, organizationId, items);
    }

    return this.findOne(id, organizationId);
  }

  private async updatePurchaseOrderItems(
    purchaseOrderId: string,
    organizationId: string,
    itemsDto: UpdatePurchaseOrderItemDto[],
  ): Promise<void> {
    // Obtener los items existentes
    const existingItems = await this.purchaseOrderItemRepository.find({
      where: {
        purchaseOrderId,
      },
    });

    // Procesar cada item del DTO
    for (const itemDto of itemsDto) {
      if (itemDto.id) {
        // Item existente - actualizar
        const existingItem = existingItems.find(
          (item) => item.id === itemDto.id,
        );
        if (existingItem) {
          // Calcular valores
          const quantity = Number(itemDto.quantity);
          const unitCost = Number(itemDto.unitCost);
          const taxPercentage = Number(itemDto.taxPercentage || 0);
          const subtotal = quantity * unitCost;
          const taxAmount = (subtotal * taxPercentage) / 100;
          const total = subtotal + taxAmount;

          // Actualizar campos básicos
          await this.purchaseOrderItemRepository.update(
            { id: itemDto.id },
            {
              productId: itemDto.productId,
              quantity: quantity,
              unitCost: unitCost,
              subtotal: subtotal,
              taxPercentage: taxPercentage,
              taxAmount: taxAmount,
              total: total,
              receivedQuantity: itemDto.receivedQuantity || 0,
              notes: itemDto.notes,
              updatedAt: new Date(),
            },
          );
        }
      } else {
        // Item nuevo - crear
        const maxLineNumber =
          existingItems.length > 0
            ? Math.max(...existingItems.map((item) => item.lineNumber))
            : 0;

        const quantity = Number(itemDto.quantity);
        const unitCost = Number(itemDto.unitCost);
        const taxPercentage = Number(itemDto.taxPercentage || 0);
        const subtotal = quantity * unitCost;
        const taxAmount = (subtotal * taxPercentage) / 100;
        const total = subtotal + taxAmount;

        const newItem = this.purchaseOrderItemRepository.create({
          purchaseOrderId,
          productId: itemDto.productId,
          lineNumber: maxLineNumber + 1,
          quantity: quantity,
          unitCost: unitCost,
          subtotal: subtotal,
          taxPercentage: taxPercentage,
          taxAmount: taxAmount,
          total: total,
          receivedQuantity: itemDto.receivedQuantity || 0,
          notes: itemDto.notes,
        });

        await this.purchaseOrderItemRepository.save(newItem);
      }
    }

    // Recalcular totales de la orden
    await this.recalculatePurchaseOrderTotals(purchaseOrderId, organizationId);
  }

  private async recalculatePurchaseOrderTotals(
    purchaseOrderId: string,
    organizationId: string,
  ): Promise<void> {
    // Obtener todos los items de la orden
    const items = await this.purchaseOrderItemRepository.find({
      where: {
        purchaseOrderId,
      },
    });

    // Calcular subtotal
    const subtotal = items.reduce((sum, item) => {
      return sum + item.quantity * item.unitCost;
    }, 0);

    // Obtener la orden para mantener los porcentajes existentes
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id: purchaseOrderId, organizationId },
    });

    if (purchaseOrder) {
      const taxPercentage = purchaseOrder.taxPercentage || 0;
      const shippingCost = purchaseOrder.shippingCost || 0;

      const taxAmount = (subtotal * taxPercentage) / 100;
      const total = subtotal + taxAmount + shippingCost;

      // Actualizar los totales
      await this.purchaseOrderRepository.update(
        { id: purchaseOrderId, organizationId },
        {
          subtotal: subtotal,
          taxAmount: taxAmount,
          total: total,
          updatedAt: new Date(),
        },
      );
    }
  }

  async approve(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, organizationId);

    if (
      purchaseOrder.status !== PurchaseOrderStatus.PENDING &&
      purchaseOrder.status !== PurchaseOrderStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Only draft or pending orders can be approved',
      );
    }

    await this.purchaseOrderRepository.update(
      { id, organizationId },
      {
        status: PurchaseOrderStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
    );

    return this.findOne(id, organizationId);
  }

  async send(
    id: string,
    organizationId: string,
    notes?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, organizationId);

    if (purchaseOrder.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException('Only approved orders can be sent');
    }

    // Actualizar metadata si se proporcionan notas
    const metadata = purchaseOrder.metadata || {};
    if (notes) {
      metadata.sendNotes = notes;
      metadata.sentAt = new Date().toISOString();
    }

    await this.purchaseOrderRepository.update(
      { id, organizationId },
      {
        status: PurchaseOrderStatus.SENT,
        metadata: notes ? metadata : purchaseOrder.metadata,
      },
    );

    return this.findOne(id, organizationId);
  }

  async receive(
    id: string,
    receiveDto: ReceivePurchaseOrderDto,
    organizationId: string,
    userId: string,
  ): Promise<PurchaseOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Cargar la orden con todos los items usando el queryRunner para mantener consistencia en la transacción
      const purchaseOrder = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id, organizationId },
        relations: [
          'supplier',
          'items',
          'items.product',
          'createdBy',
          'approvedBy',
          'batches',
        ],
      });

      if (!purchaseOrder) {
        throw new NotFoundException('Purchase order not found');
      }

      if (!purchaseOrder.canBeReceived) {
        throw new BadRequestException(
          'Purchase order cannot be received in current status',
        );
      }

      // AUTO-SELECCIÓN DE ALMACÉN: Si no se especifica warehouse, auto-seleccionar
      let targetWarehouseId = receiveDto.warehouseId;

      if (!targetWarehouseId) {
        // Obtener todos los almacenes activos de la organización
        const warehouses = await queryRunner.manager.find(Warehouse, {
          where: { organizationId, isActive: true },
          order: { isMainWarehouse: 'DESC' }, // Principal primero
        });

        if (warehouses.length === 0) {
          throw new BadRequestException(
            'No hay almacenes activos disponibles para recibir mercancía',
          );
        }

        if (warehouses.length === 1) {
          // Solo hay un almacén - auto-seleccionar
          targetWarehouseId = warehouses[0].id;
          this.logger.log(
            `🏪 AUTO-SELECCIÓN: Usando único almacén disponible: ${warehouses[0].name}`,
          );
        } else {
          // Múltiples almacenes - buscar el principal
          const mainWarehouse = warehouses.find((w) => w.isMainWarehouse);
          if (mainWarehouse) {
            targetWarehouseId = mainWarehouse.id;
            this.logger.log(
              `🏪 AUTO-SELECCIÓN: Usando almacén principal: ${mainWarehouse.name}`,
            );
          } else {
            throw new BadRequestException(
              'Tienes múltiples almacenes. Por favor especifica en cuál quieres recibir la mercancía.',
            );
          }
        }
      }

      // Validar que el almacén seleccionado existe y está activo
      const selectedWarehouse = await queryRunner.manager.findOne(Warehouse, {
        where: { id: targetWarehouseId, organizationId, isActive: true },
      });

      if (!selectedWarehouse) {
        throw new BadRequestException(
          'El almacén seleccionado no existe o no está activo',
        );
      }

      this.logger.log(
        `📦 Recibiendo mercancía en almacén: ${selectedWarehouse.name}`,
      );

      // Procesar cada item recibido
      for (const receivedItem of receiveDto.receivedItems) {
        const orderItem = await queryRunner.manager.findOne(PurchaseOrderItem, {
          where: { id: receivedItem.purchaseOrderItemId },
          relations: ['product'],
        });

        if (!orderItem) {
          throw new NotFoundException(
            `Purchase order item ${receivedItem.purchaseOrderItemId} not found`,
          );
        }

        // Debug del estado actual del item
        this.logger.log(`🚨 DEBUG VALIDATION - Item ${orderItem.id}:`);
        this.logger.log(
          `   - orderItem.quantity: ${orderItem.quantity} (type: ${typeof orderItem.quantity})`,
        );
        this.logger.log(
          `   - orderItem.receivedQuantity: ${orderItem.receivedQuantity} (type: ${typeof orderItem.receivedQuantity})`,
        );
        this.logger.log(
          `   - receivedItem.receivedQuantity: ${receivedItem.receivedQuantity} (type: ${typeof receivedItem.receivedQuantity})`,
        );

        // Calcular total procesado (recibido + dañado + faltante)
        const currentDamaged = receivedItem.damagedQuantity || 0;
        const currentMissing = receivedItem.missingQuantity || 0;
        const totalNewlyProcessed =
          receivedItem.receivedQuantity + currentDamaged + currentMissing;
        const totalProcessedSoFar =
          Number(orderItem.receivedQuantity) + totalNewlyProcessed;
        const maxAllowed =
          Number(orderItem.quantity) - Number(orderItem.receivedQuantity);

        this.logger.log(`   - totalNewlyProcessed: ${totalNewlyProcessed}`);
        this.logger.log(`   - totalProcessedSoFar: ${totalProcessedSoFar}`);
        this.logger.log(`   - maxAllowed: ${maxAllowed}`);

        // Verificar que no se procese más de lo ordenado
        if (totalProcessedSoFar > Number(orderItem.quantity)) {
          throw new BadRequestException(
            `Cannot process ${totalNewlyProcessed} units (${receivedItem.receivedQuantity} received + ${currentDamaged} damaged + ${currentMissing} missing). Maximum allowed: ${maxAllowed}`,
          );
        }

        // Usar el costo real si se proporciona, sino usar el costo original
        const actualUnitCost =
          receivedItem.actualUnitCost || orderItem.unitCost;

        // Registrar entrada en inventario para items en buen estado (crea lote automáticamente)
        if (receivedItem.receivedQuantity > 0) {
          await this.inventoryService.registerPurchase(
            orderItem.productId,
            receivedItem.receivedQuantity,
            actualUnitCost,
            organizationId,
            userId,
            purchaseOrder.id,
            {
              supplierLotNumber: receivedItem.supplierLotNumber,
              expirationDate: receivedItem.expirationDate,
              notes: receivedItem.notes,
            },
            targetWarehouseId, // ✅ Asignar almacén seleccionado/auto-seleccionado
          );
        }

        // Crear lotes separados para damaged/missing con metadata específica
        if (currentDamaged > 0) {
          await this.inventoryService.registerPurchase(
            orderItem.productId,
            0, // No agregar al inventario, solo documentar
            actualUnitCost,
            organizationId,
            userId,
            purchaseOrder.id,
            {
              supplierLotNumber: receivedItem.supplierLotNumber,
              expirationDate: receivedItem.expirationDate,
              notes: `Dañados: ${currentDamaged}`,
              type: 'damaged',
            },
            targetWarehouseId, // ✅ Asignar almacén seleccionado/auto-seleccionado
          );
        }

        if (currentMissing > 0) {
          await this.inventoryService.registerPurchase(
            orderItem.productId,
            0, // No agregar al inventario, solo documentar
            actualUnitCost,
            organizationId,
            userId,
            purchaseOrder.id,
            {
              supplierLotNumber: receivedItem.supplierLotNumber,
              expirationDate: receivedItem.expirationDate,
              notes: `Faltantes: ${currentMissing}`,
              type: 'missing',
            },
            targetWarehouseId, // ✅ Asignar almacén seleccionado/auto-seleccionado
          );
        }

        // Actualizar cantidades del item
        // Solo actualizar receivedQuantity con la cantidad realmente recibida en buen estado
        const receivedQty = Number(receivedItem.receivedQuantity);
        this.logger.log(
          `📦 DEBUG - Item ${orderItem.id}: receivedQuantity from DTO: ${receivedItem.receivedQuantity} (type: ${typeof receivedItem.receivedQuantity})`,
        );
        this.logger.log(
          `📦 DEBUG - Item ${orderItem.id}: converted receivedQty: ${receivedQty} (type: ${typeof receivedQty})`,
        );

        // Registrar en el item la cantidad total procesada (para status update)
        const totalProcessed = receivedQty + currentDamaged + currentMissing;
        this.logger.log(
          `📦 DEBUG - Total processed: ${totalProcessed} (received: ${receivedQty}, damaged: ${currentDamaged}, missing: ${currentMissing})`,
        );

        const updateResult = orderItem.receive(receivedQty);

        // pendingQuantity ahora es un getter calculado automáticamente (remainingQuantity)
        this.logger.log(
          `📦 DEBUG - Current pendingQuantity (getter): ${orderItem.pendingQuantity}`,
        );

        const savedItem = await queryRunner.manager.save(orderItem);

        // Actualizar el item en la orden para que updateStatus() vea los valores correctos
        const itemIndex = purchaseOrder.items.findIndex(
          (item) => item.id === orderItem.id,
        );
        if (itemIndex >= 0) {
          purchaseOrder.items[itemIndex] = savedItem;
          this.logger.log(
            `✅ Updated item in purchase order: receivedQuantity = ${savedItem.receivedQuantity}`,
          );
        }

        // Crear historial de precios de compra con trazabilidad completa
        const historyNotes = [
          receivedItem.notes,
          currentDamaged > 0 ? `Dañados: ${currentDamaged}` : null,
          currentMissing > 0 ? `Faltantes: ${currentMissing}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        const purchaseHistory = queryRunner.manager.create(
          ProductPurchaseHistory,
          {
            productId: orderItem.productId,
            supplierId: purchaseOrder.supplierId,
            purchaseOrderId: purchaseOrder.id,
            organizationId,
            purchaseDate: new Date(),
            quantity: receivedItem.receivedQuantity, // Solo la cantidad recibida en buen estado
            unitCost: orderItem.unitCost,
            totalCost: receivedItem.receivedQuantity * orderItem.unitCost,
            finalUnitCost: actualUnitCost,
            supplierLotNumber: receivedItem.supplierLotNumber,
            expirationDate: receivedItem.expirationDate
              ? new Date(receivedItem.expirationDate)
              : null,
            notes: historyNotes || null,
          },
        );

        await queryRunner.manager.save(purchaseHistory);
      }

      // Recargar la orden con los items actualizados para obtener cálculos correctos
      const reloadedOrder = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id, organizationId },
        relations: ['items'],
      });

      if (!reloadedOrder) {
        throw new NotFoundException(
          'Purchase order not found after item updates',
        );
      }

      // Actualizar el estado basado en los items ya guardados
      reloadedOrder.updateStatus();

      // Establecer fecha de entrega si se proporciona
      if (receiveDto.receivedDate) {
        reloadedOrder.actualDeliveryDate = new Date(receiveDto.receivedDate);
      }

      this.logger.log(`📦 Purchase Order Status Update - ID: ${reloadedOrder.id}`);
      this.logger.log(`   - Total Ordered: ${reloadedOrder.totalQuantityOrdered}`);
      this.logger.log(
        `   - Total Received: ${reloadedOrder.totalQuantityReceived}`,
      );
      this.logger.log(`   - Is Fully Received: ${reloadedOrder.isFullyReceived}`);
      this.logger.log(`   - New Status: ${reloadedOrder.status}`);

      await queryRunner.manager.save(reloadedOrder);

      await queryRunner.commitTransaction();

      return this.findOne(id, organizationId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(
    id: string,
    organizationId: string,
    reason?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(id, organizationId);

    if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException('Cannot cancel a received purchase order');
    }

    await this.purchaseOrderRepository.update(
      { id, organizationId },
      {
        status: PurchaseOrderStatus.CANCELLED,
        notes: purchaseOrder.notes
          ? `${purchaseOrder.notes}\n\nCancellation reason: ${reason || 'No reason provided'}`
          : `Cancellation reason: ${reason || 'No reason provided'}`,
      },
    );

    return this.findOne(id, organizationId);
  }

  async getOrderStats(organizationId: string): Promise<{
    total: number;
    byStatus: Record<PurchaseOrderStatus, number>;
    totalValue: number;
    averageOrderValue: number;
  }> {
    // Usar queries agregadas en vez de cargar todos los registros
    const statsResult = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .select('po.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(po.total), 0)', 'totalValue')
      .where('po.organizationId = :organizationId', { organizationId })
      .groupBy('po.status')
      .getRawMany();

    const stats = {
      total: 0,
      byStatus: {} as Record<PurchaseOrderStatus, number>,
      totalValue: 0,
      averageOrderValue: 0,
    };

    Object.values(PurchaseOrderStatus).forEach((status) => {
      stats.byStatus[status] = 0;
    });

    statsResult.forEach((row) => {
      const count = parseInt(row.count, 10);
      stats.byStatus[row.status] = count;
      stats.total += count;
      stats.totalValue += parseFloat(row.totalValue) || 0;
    });

    stats.averageOrderValue =
      stats.total > 0 ? stats.totalValue / stats.total : 0;

    return stats;
  }

  private async generateOrderNumber(
    organizationId: string,
    queryRunner: QueryRunner,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `PO-${year}${month}-`;

    // Usar MAX con FOR UPDATE para bloquear filas y evitar colisiones concurrentes
    const result = await queryRunner.query(
      `SELECT MAX("poNumber") as max_po FROM purchase_orders WHERE "organization_id" = $1 AND "poNumber" LIKE $2`,
      [organizationId, `${prefix}%`],
    );

    let sequence = 1;
    if (result[0]?.max_po) {
      const lastNum = parseInt(result[0].max_po.replace(prefix, ''), 10);
      if (!isNaN(lastNum)) {
        sequence = lastNum + 1;
      }
    }

    const orderNumber = `${prefix}${String(sequence).padStart(6, '0')}`;
    this.logger.log(
      `generateOrderNumber: MAX="${result[0]?.max_po || 'null'}" → next="${orderNumber}" (org: ${organizationId.substring(0, 8)}...)`,
    );
    return orderNumber;
  }
}
