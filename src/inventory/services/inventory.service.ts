import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  QueryRunner,
  MoreThanOrEqual,
  LessThanOrEqual,
  MoreThan,
} from 'typeorm';
import {
  InventoryMovement,
  MovementType,
  MovementStatus,
} from '../entities/inventory-movement.entity';
import {
  InventoryBatch,
  BatchStatus,
} from '../entities/inventory-batch.entity';
import {
  InventoryBatchMovement,
  BatchMovementType,
} from '../entities/inventory-batch-movement.entity';
import { Product } from '../../products/entities/product.entity';
import { PurchaseOrder } from '../entities/purchase-order.entity';

export interface FifoConsumptionResult {
  batches: Array<{
    batchId: string;
    batchNumber: string;
    quantityConsumed: number;
    unitCost: number;
    totalCost: number;
    purchaseDate: Date;
  }>;
  totalQuantityConsumed: number;
  totalCost: number;
  averageCost: number;
}

export interface InventoryValuation {
  productId: string;
  productName: string;
  productSku: string;
  totalQuantity: number;
  totalValue: number;
  averageCost: number;
  batches: Array<{
    batchId: string;
    batchNumber: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
    purchaseDate: Date;
    daysInInventory: number;
  }>;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(InventoryBatch)
    private batchRepository: Repository<InventoryBatch>,
    @InjectRepository(InventoryBatchMovement)
    private batchMovementRepository: Repository<InventoryBatchMovement>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  /**
   * Registrar entrada de inventario (compra)
   * Crea un nuevo lote para implementar PEPS/FIFO
   */
  async registerPurchase(
    productId: string,
    quantity: number,
    unitCost: number,
    organizationId: string,
    userId: string,
    purchaseOrderId?: string,
    metadata?: any,
    warehouseId?: string,
  ): Promise<{ movement: InventoryMovement; batch: InventoryBatch }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el producto existe
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId, organizationId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Crear nuevo lote
      const batch = queryRunner.manager.create(InventoryBatch, {
        batchNumber: await this.generateBatchNumber(
          organizationId,
          queryRunner,
        ),
        productId,
        organizationId,
        purchaseDate: new Date(),
        originalQuantity: quantity,
        currentQuantity: quantity,
        reservedQuantity: 0,
        unitCost,
        totalCost: quantity * unitCost,
        remainingValue: quantity * unitCost,
        status: BatchStatus.ACTIVE,
        purchaseOrderId,
        metadata,
      });

      const savedBatch = await queryRunner.manager.save(batch);

      // Obtener stock actual del producto
      const currentStock = await this.getCurrentStock(
        productId,
        organizationId,
        queryRunner,
      );

      // Crear movimiento de inventario
      const movement = queryRunner.manager.create(InventoryMovement, {
        movementNumber: await this.generateMovementNumber(
          organizationId,
          queryRunner,
        ),
        type: MovementType.PURCHASE,
        status: MovementStatus.CONFIRMED,
        productId,
        organizationId,
        createdById: userId,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        stockAfter: currentStock + quantity,
        stockValueAfter:
          (await this.calculateStockValue(
            productId,
            organizationId,
            queryRunner,
          )) +
          quantity * unitCost,
        referenceType: 'purchase_order',
        referenceId: purchaseOrderId,
        warehouseId,
        metadata,
      });

      const savedMovement = await queryRunner.manager.save(movement);

      // Crear movimiento del lote
      const batchMovement = queryRunner.manager.create(InventoryBatchMovement, {
        type: BatchMovementType.CONSUME, // En este caso es entrada, pero usamos CONSUME por consistencia
        batchId: savedBatch.id,
        inventoryMovementId: savedMovement.id,
        organizationId,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        batchQuantityAfter: savedBatch.currentQuantity,
        batchValueAfter: savedBatch.remainingValue,
      });

      await queryRunner.manager.save(batchMovement);

      // Actualizar stock del producto
      await this.updateProductStock(productId, organizationId, queryRunner);

      await queryRunner.commitTransaction();

      return { movement: savedMovement, batch: savedBatch };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Registrar salida de inventario (venta) usando PEPS/FIFO
   */
  async registerSale(
    productId: string,
    quantity: number,
    unitPrice: number,
    organizationId: string,
    userId: string,
    referenceType?: string,
    referenceId?: string,
    metadata?: any,
    warehouseId?: string,
    externalQueryRunner?: QueryRunner,
  ): Promise<{
    movement: InventoryMovement;
    fifoResult: FifoConsumptionResult;
  }> {
    const queryRunner =
      externalQueryRunner || this.dataSource.createQueryRunner();
    const shouldManageTransaction = !externalQueryRunner;

    if (shouldManageTransaction) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      // Verificar stock disponible
      const availableStock = await this.getAvailableStock(
        productId,
        organizationId,
        queryRunner,
      );

      if (availableStock < quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
        );
      }

      // Consumir stock usando FIFO
      const fifoResult = await this.consumeStockFifo(
        productId,
        quantity,
        organizationId,
        queryRunner,
      );

      // Obtener stock actual después del consumo
      const currentStock = await this.getCurrentStock(
        productId,
        organizationId,
        queryRunner,
      );

      // Crear movimiento de inventario
      const movement = queryRunner.manager.create(InventoryMovement, {
        movementNumber: await this.generateMovementNumber(
          organizationId,
          queryRunner,
        ),
        type: MovementType.SALE,
        status: MovementStatus.CONFIRMED,
        productId,
        organizationId,
        createdById: userId,
        quantity: -quantity, // Negativo para salidas
        unitCost: fifoResult.averageCost,
        totalCost: fifoResult.totalCost,
        unitPrice,
        totalPrice: quantity * unitPrice,
        stockAfter: currentStock,
        stockValueAfter: await this.calculateStockValue(
          productId,
          organizationId,
          queryRunner,
        ),
        referenceType,
        referenceId,
        warehouseId,
        metadata,
      });

      const savedMovement = await queryRunner.manager.save(movement);

      // Crear movimientos de lote para cada lote consumido
      for (const batchConsumption of fifoResult.batches) {
        const batchMovement = queryRunner.manager.create(
          InventoryBatchMovement,
          {
            type: BatchMovementType.CONSUME,
            batchId: batchConsumption.batchId,
            inventoryMovementId: savedMovement.id,
            organizationId,
            quantity: -batchConsumption.quantityConsumed, // Negativo para consumo
            unitCost: batchConsumption.unitCost,
            totalCost: batchConsumption.totalCost,
            batchQuantityAfter: 0, // Se actualizará después
            batchValueAfter: 0, // Se actualizará después
          },
        );

        // Obtener estado actual del lote para actualizar los campos "after"
        const batch = await queryRunner.manager.findOne(InventoryBatch, {
          where: { id: batchConsumption.batchId },
        });

        if (batch) {
          batchMovement.batchQuantityAfter = batch.currentQuantity;
          batchMovement.batchValueAfter = batch.remainingValue;
        }

        await queryRunner.manager.save(batchMovement);
      }

      // Actualizar stock del producto
      await this.updateProductStock(productId, organizationId, queryRunner);

      if (shouldManageTransaction) {
        await queryRunner.commitTransaction();
      }

      return { movement: savedMovement, fifoResult };
    } catch (error) {
      if (shouldManageTransaction) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Consumir stock usando lógica FIFO
   */
  private async consumeStockFifo(
    productId: string,
    quantityToConsume: number,
    organizationId: string,
    queryRunner: QueryRunner,
  ): Promise<FifoConsumptionResult> {
    // Obtener lotes activos con stock disponible ordenados por fecha de compra (FIFO)
    const activeBatches = await queryRunner.manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .andWhere('batch.currentQuantity > batch.reservedQuantity') // Solo lotes con stock disponible
      .andWhere('batch.currentQuantity > 0') // Evitar lotes agotados
      .orderBy('batch.purchaseDate', 'ASC') // FIFO: primero en entrar, primero en salir
      .addOrderBy('batch.createdAt', 'ASC')
      .getMany();

    const result: FifoConsumptionResult = {
      batches: [],
      totalQuantityConsumed: 0,
      totalCost: 0,
      averageCost: 0,
    };

    let remainingToConsume = quantityToConsume;

    for (const batch of activeBatches) {
      if (remainingToConsume <= 0) break;

      const availableInBatch = batch.availableQuantity;
      if (availableInBatch <= 0) continue;

      const consumeFromBatch = Math.min(remainingToConsume, availableInBatch);
      const batchConsumption = batch.consume(consumeFromBatch);

      // Actualizar el lote en la base de datos
      await queryRunner.manager.save(batch);

      result.batches.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantityConsumed: batchConsumption.consumed,
        unitCost: batch.unitCost,
        totalCost: batchConsumption.cost,
        purchaseDate: batch.purchaseDate,
      });

      result.totalQuantityConsumed += batchConsumption.consumed;
      result.totalCost += batchConsumption.cost;
      remainingToConsume -= batchConsumption.consumed;
    }

    if (remainingToConsume > 0) {
      throw new BadRequestException(
        `Insufficient stock in active batches. Missing: ${remainingToConsume}`,
      );
    }

    result.averageCost =
      result.totalQuantityConsumed > 0
        ? result.totalCost / result.totalQuantityConsumed
        : 0;

    return result;
  }

  /**
   * Obtener valoración actual del inventario por producto
   */
  async getInventoryValuation(
    productId: string,
    organizationId: string,
  ): Promise<InventoryValuation> {
    const product = await this.productRepository.findOne({
      where: { id: productId, organizationId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const activeBatches = await this.batchRepository.find({
      where: {
        productId,
        organizationId,
        status: BatchStatus.ACTIVE,
      },
      order: {
        purchaseDate: 'ASC',
      },
    });

    const batches = activeBatches.map((batch) => ({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: batch.currentQuantity,
      unitCost: batch.unitCost,
      totalValue: batch.remainingValue,
      purchaseDate: batch.purchaseDate,
      daysInInventory: Math.floor(
        (new Date().getTime() - batch.purchaseDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    }));

    const totalQuantity = batches.reduce((sum, b) => sum + b.quantity, 0);
    const totalValue = batches.reduce((sum, b) => sum + b.totalValue, 0);

    return {
      productId,
      productName: product.name,
      productSku: product.sku,
      totalQuantity,
      totalValue,
      averageCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
      batches,
    };
  }

  /**
   * Obtener stock actual de un producto
   */
  async getCurrentStock(
    productId: string,
    organizationId: string,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const manager = queryRunner?.manager || this.dataSource.manager;

    const result = await manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .select('SUM(batch.currentQuantity)', 'total')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  /**
   * Obtener stock disponible (actual - reservado)
   */
  async getAvailableStock(
    productId: string,
    organizationId: string,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const manager = queryRunner?.manager || this.dataSource.manager;

    const result = await manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .select(
        'SUM(batch.currentQuantity - batch.reservedQuantity)',
        'available',
      )
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .getRawOne();

    return Math.max(0, parseFloat(result?.available || '0'));
  }

  /**
   * Calcular valor total del stock
   */
  private async calculateStockValue(
    productId: string,
    organizationId: string,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const manager = queryRunner?.manager || this.dataSource.manager;

    const result = await manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .select('SUM(batch.remainingValue)', 'totalValue')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .getRawOne();

    return parseFloat(result?.totalValue || '0');
  }

  /**
   * Actualizar stock del producto
   */
  private async updateProductStock(
    productId: string,
    organizationId: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const currentStock = await this.getCurrentStock(
      productId,
      organizationId,
      queryRunner,
    );

    await queryRunner.manager.update(
      Product,
      { id: productId, organizationId },
      { stock: currentStock },
    );
  }

  /**
   * Generar número de movimiento único
   */
  private async generateMovementNumber(
    organizationId: string,
    queryRunner: QueryRunner,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `MOV-${year}${month}-`;

    // Use a robust approach with proper LIKE pattern matching
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        // Find all existing movement numbers for this month/year pattern
        const existingMovements = await queryRunner.manager
          .createQueryBuilder(InventoryMovement, 'movement')
          .select('movement.movementNumber')
          .where('movement.organizationId = :organizationId', {
            organizationId,
          })
          .andWhere('movement.movementNumber LIKE :pattern', {
            pattern: `${prefix}%`,
          })
          .orderBy('movement.movementNumber', 'DESC')
          .getMany();

        // Extract sequence numbers and find the highest one
        let maxSequence = 0;
        for (const movement of existingMovements) {
          const sequencePart = movement.movementNumber.substring(prefix.length);
          const sequenceNumber = parseInt(sequencePart);
          if (!isNaN(sequenceNumber) && sequenceNumber > maxSequence) {
            maxSequence = sequenceNumber;
          }
        }

        const nextSequence = maxSequence + 1;
        const sequence = String(nextSequence).padStart(6, '0');
        const newMovementNumber = `${prefix}${sequence}`;

        // Double-check that this movement number doesn't exist (handles race conditions)
        const existingCheck = await queryRunner.manager.findOne(
          InventoryMovement,
          {
            where: {
              organizationId,
              movementNumber: newMovementNumber,
            },
          },
        );

        if (!existingCheck) {
          return newMovementNumber;
        }

        // If it exists, increment attempts and try again
        attempts++;

        // Add a small random delay to reduce collision probability
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 10 + 5),
        );
      } catch (error) {
        console.error(
          `Error generating movement number (attempt ${attempts + 1}):`,
          error,
        );
        attempts++;
        if (attempts >= maxAttempts) {
          // Fallback: use timestamp-based unique number
          const timestamp = Date.now().toString().slice(-6);
          const randomSuffix = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0');
          const fallbackNumber = `${prefix}${timestamp}${randomSuffix}`;
          console.warn(`Using fallback movement number: ${fallbackNumber}`);
          return fallbackNumber;
        }
      }
    }

    // Final fallback with timestamp and random component
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const finalFallback = `${prefix}${timestamp}${randomSuffix}`;
    console.warn(`Using final fallback movement number: ${finalFallback}`);
    return finalFallback;
  }

  /**
   * Generar número de lote único
   */
  private async generateBatchNumber(
    organizationId: string,
    queryRunner: QueryRunner,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `BATCH-${year}${month}-`;

    // Use a robust approach with proper LIKE pattern matching
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        // Find all existing batch numbers for this month/year pattern
        const existingBatches = await queryRunner.manager
          .createQueryBuilder(InventoryBatch, 'batch')
          .select('batch.batchNumber')
          .where('batch.organizationId = :organizationId', { organizationId })
          .andWhere('batch.batchNumber LIKE :pattern', {
            pattern: `${prefix}%`,
          })
          .orderBy('batch.batchNumber', 'DESC')
          .getMany();

        // Extract sequence numbers and find the highest one
        let maxSequence = 0;
        for (const batch of existingBatches) {
          const sequencePart = batch.batchNumber.substring(prefix.length);
          const sequenceNumber = parseInt(sequencePart);
          if (!isNaN(sequenceNumber) && sequenceNumber > maxSequence) {
            maxSequence = sequenceNumber;
          }
        }

        const nextSequence = maxSequence + 1;
        const sequence = String(nextSequence).padStart(6, '0');
        const newBatchNumber = `${prefix}${sequence}`;

        // Double-check that this batch number doesn't exist (handles race conditions)
        const existingCheck = await queryRunner.manager.findOne(
          InventoryBatch,
          {
            where: {
              organizationId,
              batchNumber: newBatchNumber,
            },
          },
        );

        if (!existingCheck) {
          return newBatchNumber;
        }

        // If it exists, increment attempts and try again
        attempts++;

        // Add a small random delay to reduce collision probability
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 10 + 5),
        );
      } catch (error) {
        console.error(
          `Error generating batch number (attempt ${attempts + 1}):`,
          error,
        );
        attempts++;
        if (attempts >= maxAttempts) {
          // Fallback: use timestamp-based unique number
          const timestamp = Date.now().toString().slice(-6);
          const randomSuffix = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0');
          const fallbackNumber = `${prefix}${timestamp}${randomSuffix}`;
          console.warn(`Using fallback batch number: ${fallbackNumber}`);
          return fallbackNumber;
        }
      }
    }

    // Final fallback with timestamp and random component
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const finalFallback = `${prefix}${timestamp}${randomSuffix}`;
    console.warn(`Using final fallback batch number: ${finalFallback}`);
    return finalFallback;
  }

  /**
   * Obtener Kardex de un producto
   */
  async getProductKardex(
    productId: string,
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<InventoryMovement[]> {
    const queryBuilder = this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .leftJoinAndSelect('movement.createdBy', 'user')
      .where('movement.productId = :productId', { productId })
      .andWhere('movement.organizationId = :organizationId', { organizationId })
      .orderBy('movement.movementDate', 'ASC');

    if (startDate) {
      queryBuilder.andWhere('movement.movementDate >= :startDate', {
        startDate,
      });
    }

    if (endDate) {
      queryBuilder.andWhere('movement.movementDate <= :endDate', { endDate });
    }

    return queryBuilder.getMany();
  }

  /**
   * Obtener movimientos de inventario con paginación
   */
  async getInventoryMovements(
    organizationId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      productId?: string;
      type?: MovementType | 'transfer';
      status?: MovementStatus;
      startDate?: Date;
      endDate?: Date;
      searchTerm?: string;
      warehouseId?: string;
    },
  ): Promise<{
    movements: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const queryBuilder = this.movementRepository
        .createQueryBuilder('movement')
        .leftJoinAndSelect('movement.product', 'product')
        .leftJoinAndSelect('movement.createdBy', 'user')
        .where('movement.organizationId = :organizationId', { organizationId });

      if (filters?.productId) {
        queryBuilder.andWhere('movement.productId = :productId', {
          productId: filters.productId,
        });
      }

      if (filters?.type) {
        // Handle special case: 'transfer' should match both 'transfer_in' and 'transfer_out'
        if (filters.type === 'transfer') {
          queryBuilder.andWhere('movement.type IN (:...transferTypes)', {
            transferTypes: ['transfer_in', 'transfer_out'],
          });
        } else {
          queryBuilder.andWhere('movement.type = :type', {
            type: filters.type,
          });
        }
      }

      if (filters?.status) {
        queryBuilder.andWhere('movement.status = :status', {
          status: filters.status,
        });
      }

      if (filters?.startDate) {
        queryBuilder.andWhere('movement.movementDate >= :startDate', {
          startDate: filters.startDate,
        });
      }

      if (filters?.endDate) {
        queryBuilder.andWhere('movement.movementDate <= :endDate', {
          endDate: filters.endDate,
        });
      }

      if (filters?.searchTerm) {
        queryBuilder.andWhere(
          '(product.name ILIKE :searchTerm OR product.sku ILIKE :searchTerm OR movement.movementNumber ILIKE :searchTerm)',
          { searchTerm: `%${filters.searchTerm}%` },
        );
      }

      if (filters?.warehouseId) {
        queryBuilder.andWhere('movement.warehouseId = :warehouseId', {
          warehouseId: filters.warehouseId,
        });
      }

      queryBuilder.orderBy('movement.movementDate', 'DESC');

      const [movements, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      // Debug: Check if products are loaded
      console.log(
        '🔍 DEBUG: First movement:',
        JSON.stringify(movements[0], null, 2),
      );
      console.log('🔍 DEBUG: Product info:', movements[0]?.product);
      console.log('🔍 DEBUG: Total movements found:', movements.length);
      console.log('🔍 DEBUG: About to transform movements...');

      // Transform movements to include productName and productSku in flat structure
      const transformedMovements = movements.map((movement) => {
        console.log(
          `🔍 DEBUG: Processing movement ${movement.id}, product:`,
          movement.product,
        );
        return {
          ...movement,
          productName: movement.product?.name || null,
          productSku: movement.product?.sku || null,
          // Remove the nested product object to avoid confusion
          product: null,
          createdBy: null, // Also clean up the user relation to reduce payload
        };
      });

      console.log(
        '🔍 DEBUG: First transformed movement:',
        JSON.stringify(transformedMovements[0], null, 2),
      );

      return {
        movements: transformedMovements,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error retrieving inventory movements: ${error.message}`,
      );
    }
  }

  /**
   * Registrar ajuste manual de inventario
   */
  async registerAdjustment(
    productId: string,
    adjustmentQuantity: number,
    reason: string,
    organizationId: string,
    userId: string,
    unitCost?: number,
    metadata?: any,
  ): Promise<InventoryMovement> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el producto existe
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId, organizationId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Obtener stock actual
      const currentStock = await this.getCurrentStock(
        productId,
        organizationId,
        queryRunner,
      );

      // Validar que el ajuste no resulte en stock negativo
      if (currentStock + adjustmentQuantity < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative stock. Current: ${currentStock}, Adjustment: ${adjustmentQuantity}`,
        );
      }

      let movement: InventoryMovement;
      const stockValueBefore = await this.calculateStockValue(
        productId,
        organizationId,
        queryRunner,
      );

      if (adjustmentQuantity > 0) {
        // Ajuste positivo - crear nuevo lote
        // Obtener precio de costo del producto
        const costPrice = product.prices?.find(
          (p) => p.type === 'cost' && p.isActive,
        );
        const costPerUnit =
          unitCost || (costPrice ? Number(costPrice.amount) : 0);

        const batch = queryRunner.manager.create(InventoryBatch, {
          batchNumber: await this.generateBatchNumber(
            organizationId,
            queryRunner,
          ),
          productId,
          organizationId,
          purchaseDate: new Date(),
          originalQuantity: adjustmentQuantity,
          currentQuantity: adjustmentQuantity,
          reservedQuantity: 0,
          unitCost: costPerUnit,
          totalCost: adjustmentQuantity * costPerUnit,
          remainingValue: adjustmentQuantity * costPerUnit,
          status: BatchStatus.ACTIVE,
          warehouseId: metadata?.warehouseId,
          metadata: { ...metadata, adjustmentReason: reason },
        });

        const savedBatch = await queryRunner.manager.save(batch);

        // Crear movimiento de inventario
        movement = queryRunner.manager.create(InventoryMovement, {
          movementNumber: await this.generateMovementNumber(
            organizationId,
            queryRunner,
          ),
          type: MovementType.ADJUSTMENT,
          status: MovementStatus.CONFIRMED,
          productId,
          organizationId,
          createdById: userId,
          quantity: adjustmentQuantity,
          unitCost: costPerUnit,
          totalCost: adjustmentQuantity * costPerUnit,
          stockAfter: currentStock + adjustmentQuantity,
          stockValueAfter: stockValueBefore + adjustmentQuantity * costPerUnit,
          referenceType: 'adjustment',
          warehouseId: metadata?.warehouseId,
          metadata: { reason, ...metadata },
        });

        const savedMovement = await queryRunner.manager.save(movement);

        // Crear movimiento del lote
        const batchMovement = queryRunner.manager.create(
          InventoryBatchMovement,
          {
            type: BatchMovementType.CONSUME,
            batchId: savedBatch.id,
            inventoryMovementId: savedMovement.id,
            organizationId,
            quantity: adjustmentQuantity,
            unitCost: costPerUnit,
            totalCost: adjustmentQuantity * costPerUnit,
            batchQuantityAfter: savedBatch.currentQuantity,
            batchValueAfter: savedBatch.remainingValue,
          },
        );

        await queryRunner.manager.save(batchMovement);
      } else {
        // Ajuste negativo - consumir stock usando FIFO
        const quantityToConsume = Math.abs(adjustmentQuantity);

        const fifoResult = metadata?.warehouseId
          ? await this.consumeStockFifoByWarehouse(
              productId,
              quantityToConsume,
              organizationId,
              metadata.warehouseId,
              queryRunner,
            )
          : await this.consumeStockFifo(
              productId,
              quantityToConsume,
              organizationId,
              queryRunner,
            );

        // Crear movimiento de inventario
        movement = queryRunner.manager.create(InventoryMovement, {
          movementNumber: await this.generateMovementNumber(
            organizationId,
            queryRunner,
          ),
          type: MovementType.ADJUSTMENT,
          status: MovementStatus.CONFIRMED,
          productId,
          organizationId,
          createdById: userId,
          quantity: adjustmentQuantity, // Negativo
          unitCost: fifoResult.averageCost,
          totalCost: fifoResult.totalCost,
          stockAfter: currentStock + adjustmentQuantity,
          stockValueAfter: stockValueBefore - fifoResult.totalCost,
          referenceType: 'adjustment',
          warehouseId: metadata?.warehouseId,
          metadata: { reason, ...metadata },
        });

        const savedMovement = await queryRunner.manager.save(movement);

        // Crear movimientos de lote para cada lote consumido
        for (const batchConsumption of fifoResult.batches) {
          const batchMovement = queryRunner.manager.create(
            InventoryBatchMovement,
            {
              type: BatchMovementType.CONSUME,
              batchId: batchConsumption.batchId,
              inventoryMovementId: savedMovement.id,
              organizationId,
              quantity: -batchConsumption.quantityConsumed,
              unitCost: batchConsumption.unitCost,
              totalCost: batchConsumption.totalCost,
              batchQuantityAfter: 0,
              batchValueAfter: 0,
            },
          );

          // Obtener estado actual del lote
          const batch = await queryRunner.manager.findOne(InventoryBatch, {
            where: { id: batchConsumption.batchId },
          });

          if (batch) {
            batchMovement.batchQuantityAfter = batch.currentQuantity;
            batchMovement.batchValueAfter = batch.remainingValue;
          }

          await queryRunner.manager.save(batchMovement);
        }
      }

      // Actualizar stock del producto
      await this.updateProductStock(productId, organizationId, queryRunner);

      await queryRunner.commitTransaction();

      return movement;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtener lotes de un producto específico
   */
  async getProductBatches(
    productId: string,
    organizationId: string,
    status?: BatchStatus,
    includeExpired?: boolean,
  ): Promise<InventoryBatch[]> {
    try {
      const queryBuilder = this.batchRepository
        .createQueryBuilder('batch')
        .leftJoinAndSelect('batch.product', 'product')
        .where('batch.productId = :productId', { productId })
        .andWhere('batch.organizationId = :organizationId', { organizationId });

      if (status) {
        queryBuilder.andWhere('batch.status = :status', { status });
      }

      if (!includeExpired) {
        queryBuilder.andWhere('batch.status != :expiredStatus', {
          expiredStatus: BatchStatus.EXPIRED,
        });
      }

      queryBuilder.orderBy('batch.purchaseDate', 'ASC');

      const batches = await queryBuilder.getMany();

      // Verificar que el producto existe si no se encontraron lotes
      if (batches.length === 0) {
        const product = await this.productRepository.findOne({
          where: { id: productId, organizationId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${productId} not found`);
        }
      }

      return batches;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving product batches: ${error.message}`,
      );
    }
  }

  /**
   * Obtener resumen general del inventario de la organización
   */
  async getInventorySummary(
    organizationId: string,
    filters?: {
      productIds?: string[];
      includeInactive?: boolean;
    },
  ): Promise<{
    totalProducts: number;
    totalValue: number;
    totalQuantity: number;
    lowStockProducts: number;
    expiredBatches: number;
    products: Array<{
      productId: string;
      productName: string;
      productSku: string;
      currentStock: number;
      stockValue: number;
      averageCost: number;
      activeBatches: number;
      oldestBatchDate?: Date;
      isLowStock: boolean;
    }>;
  }> {
    try {
      // Query para obtener resumen por producto
      const queryBuilder = this.batchRepository
        .createQueryBuilder('batch')
        .leftJoinAndSelect('batch.product', 'product')
        .select([
          'product.id as productId',
          'product.name as productName',
          'product.sku as productSku',
          'product.minStock as minStock',
          'SUM(batch.currentQuantity) as currentStock',
          'SUM(batch.remainingValue) as stockValue',
          'AVG(batch.unitCost) as averageCost',
          'COUNT(batch.id) as activeBatches',
          'MIN(batch.purchaseDate) as oldestBatchDate',
        ])
        .where('batch.organizationId = :organizationId', { organizationId })
        .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
        .groupBy('product.id, product.name, product.sku, product.minStock');

      if (filters?.productIds && filters.productIds.length > 0) {
        queryBuilder.andWhere('batch.productId IN (:...productIds)', {
          productIds: filters.productIds,
        });
      }

      if (!filters?.includeInactive) {
        queryBuilder.andWhere('product.isActive = :isActive', {
          isActive: true,
        });
      }

      const productSummaries = await queryBuilder.getRawMany();

      // Contar productos con stock bajo
      let lowStockProducts = 0;
      const products = productSummaries.map((summary) => {
        const currentStock = parseFloat(summary.currentstock || '0');
        const stockValue = parseFloat(summary.stockvalue || '0');
        const averageCost = parseFloat(summary.averagecost || '0');
        const activeBatches = parseInt(summary.activebatches || '0');
        const minStock = parseFloat(summary.minstock || '0');
        const isLowStock = currentStock <= minStock;

        if (isLowStock) {
          lowStockProducts++;
        }

        return {
          productId: summary.productid,
          productName: summary.productname,
          productSku: summary.productsku,
          currentStock,
          stockValue,
          averageCost,
          activeBatches,
          oldestBatchDate: summary.oldestbatchdate
            ? new Date(summary.oldestbatchdate)
            : undefined,
          isLowStock,
        };
      });

      // Contar lotes expirados
      const expiredBatchesCount = await this.batchRepository.count({
        where: {
          organizationId,
          status: BatchStatus.EXPIRED,
        },
      });

      // Calcular totales
      const totalProducts = products.length;
      const totalValue = products.reduce((sum, p) => sum + p.stockValue, 0);
      const totalQuantity = products.reduce(
        (sum, p) => sum + p.currentStock,
        0,
      );

      return {
        totalProducts,
        totalValue,
        totalQuantity,
        lowStockProducts,
        expiredBatches: expiredBatchesCount,
        products,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error retrieving inventory summary: ${error.message}`,
      );
    }
  }

  // Método para obtener estadísticas de inventario
  async getInventoryStats(
    organizationId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      warehouseId?: string;
      categoryId?: string;
    },
  ) {
    try {
      // Obtener estadísticas básicas
      const totalProducts = await this.productRepository.count({
        where: { organizationId },
      });

      const totalBatches = await this.batchRepository.count({
        where: { organizationId },
      });

      // Contar movimientos con filtros de fecha
      const movementQueryBuilder = this.movementRepository
        .createQueryBuilder('movement')
        .where('movement.organizationId = :organizationId', { organizationId });

      if (filters?.startDate) {
        movementQueryBuilder.andWhere('movement.movementDate >= :startDate', {
          startDate: filters.startDate,
        });
      }

      if (filters?.endDate) {
        movementQueryBuilder.andWhere('movement.movementDate <= :endDate', {
          endDate: filters.endDate,
        });
      }

      const totalMovements = await movementQueryBuilder.getCount();

      // Obtener valor total del inventario
      const batches = await this.batchRepository.find({
        where: { organizationId, currentQuantity: MoreThan(0) },
      });

      const totalValue = batches.reduce(
        (sum, batch) => sum + batch.currentQuantity * batch.unitCost,
        0,
      );

      // Movimientos por tipo
      const movementsByType = await this.movementRepository
        .createQueryBuilder('movement')
        .select('movement.type, COUNT(*) as count')
        .where('movement.organizationId = :organizationId', { organizationId })
        .groupBy('movement.type')
        .getRawMany();

      return {
        totalProducts,
        totalBatches,
        totalMovements,
        totalValue,
        movementsByType: movementsByType.reduce((acc, item) => {
          acc[item.type] = parseInt(item.count);
          return acc;
        }, {}),
      };
    } catch (error) {
      throw new BadRequestException(
        `Error getting inventory stats: ${error.message}`,
      );
    }
  }

  /**
   * Obtener balances de inventario filtrados por almacén
   * IMPORTANTE: El stock por almacén se basa en lotes que fueron creados por movimientos de ese almacén
   */
  private async getInventoryBalancesByWarehouse(
    organizationId: string,
    warehouseId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      search?: string;
      categoryId?: string;
      lowStock?: boolean;
      outOfStock?: boolean;
      nearExpiry?: boolean;
      expired?: boolean;
    },
    sortBy: string = 'productName',
    sortOrder: string = 'asc',
  ) {
    try {
      console.log(`🏢 Filtrando inventario por almacén: ${warehouseId}`);

      // Si el almacén no existe o es inválido, retornar resultado vacío
      if (!warehouseId || warehouseId.trim() === '') {
        return {
          data: [],
          total: 0,
          page,
          totalPages: 0,
        };
      }

      // Obtener productos por almacén usando warehouse_id directo en los lotes
      const queryBuilder = this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.category', 'category')
        .innerJoin(
          'inventory_batches',
          'batch',
          'batch.product_id = product.id AND batch.organization_id = :organizationId AND batch.status = :batchStatus AND batch.warehouse_id = :warehouseId AND batch.deleted_at IS NULL',
        )
        .select([
          '"product"."id" as productId',
          '"product"."name" as productName',
          '"product"."sku" as productSku',
          '"product"."minStock" as minStock',
          'COALESCE("category"."name", \'Sin categoría\') as categoryName',
          'COALESCE(SUM("batch"."currentQuantity"), 0) as totalQuantity',
          'COALESCE(AVG("batch"."unitCost"), 0) as averageCost',
          'COALESCE(SUM("batch"."currentQuantity" * "batch"."unitCost"), 0) as totalValue',
        ])
        .where('"product"."organization_id" = :organizationId', {
          organizationId,
          batchStatus: 'active',
          warehouseId,
        })
        .andWhere('"product"."deleted_at" IS NULL')
        .groupBy(
          '"product"."id", "product"."name", "product"."sku", "product"."minStock", "category"."name"',
        )
        .having('COALESCE(SUM("batch"."currentQuantity"), 0) > 0'); // Solo productos que tienen stock en el almacén

      if (filters?.search) {
        queryBuilder.andWhere(
          '("product"."name" ILIKE :search OR "product"."sku" ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      if (filters?.categoryId) {
        queryBuilder.andWhere('"product"."categoryId" = :categoryId', {
          categoryId: filters.categoryId,
        });
      }

      if (filters?.lowStock) {
        queryBuilder.andHaving(
          'COALESCE(SUM("batch"."currentQuantity"), 0) <= MAX("product"."minStock") AND COALESCE(SUM("batch"."currentQuantity"), 0) > 0',
        );
      }

      if (filters?.outOfStock) {
        queryBuilder.andHaving(
          'COALESCE(SUM("batch"."currentQuantity"), 0) = 0',
        );
      }

      if (filters?.nearExpiry) {
        const nearExpiryDate = new Date();
        nearExpiryDate.setDate(nearExpiryDate.getDate() + 30);

        queryBuilder.andWhere(
          `EXISTS (
            SELECT 1 FROM inventory_batches b2 
            WHERE b2.product_id = product.id 
              AND b2.organization_id = :organizationId 
              AND b2.status = :batchStatus
              AND b2."expirationDate" IS NOT NULL
              AND b2."expirationDate" <= :nearExpiryDate 
              AND b2."expirationDate" > CURRENT_DATE
              AND b2.deleted_at IS NULL
          )`,
          { nearExpiryDate },
        );
      }

      if (filters?.expired) {
        queryBuilder.andWhere(
          `EXISTS (
            SELECT 1 FROM inventory_batches b2 
            WHERE b2.product_id = product.id 
              AND b2.organization_id = :organizationId 
              AND b2.status = :batchStatus
              AND b2."expirationDate" IS NOT NULL
              AND b2."expirationDate" < CURRENT_DATE
              AND b2.deleted_at IS NULL
          )`,
        );
      }

      const orderDirection =
        sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const sortFieldMap = {
        productName: '"product"."name"',
        productSku: '"product"."sku"',
        categoryName: '"category"."name"',
        totalQuantity: 'SUM("batch"."currentQuantity")',
        totalValue: 'SUM("batch"."currentQuantity" * "batch"."unitCost")',
        averageCost: 'AVG("batch"."unitCost")',
      };

      const actualSortField = sortFieldMap[sortBy] || '"product"."name"';
      queryBuilder.orderBy(actualSortField, orderDirection);

      // Consulta para contar usando warehouse_id directo
      const countQueryBuilder = this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.category', 'category')
        .innerJoin(
          'inventory_batches',
          'batch',
          'batch.product_id = product.id AND batch.organization_id = :organizationId AND batch.status = :batchStatus AND batch.warehouse_id = :warehouseId AND batch.deleted_at IS NULL',
        )
        .select('COUNT(DISTINCT "product"."id") as count')
        .where('"product"."organization_id" = :organizationId', {
          organizationId,
          batchStatus: 'active',
          warehouseId,
        })
        .andWhere('"product"."deleted_at" IS NULL')
        .having('COALESCE(SUM("batch"."currentQuantity"), 0) > 0');

      if (filters?.search) {
        countQueryBuilder.andWhere(
          '("product"."name" ILIKE :search OR "product"."sku" ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      if (filters?.categoryId) {
        countQueryBuilder.andWhere('"product"."categoryId" = :categoryId', {
          categoryId: filters.categoryId,
        });
      }

      // Aplicar los mismos filtros de stock que en la consulta principal
      if (filters?.lowStock) {
        countQueryBuilder.andHaving(
          'COALESCE(SUM("batch"."currentQuantity"), 0) <= MAX("product"."minStock") AND COALESCE(SUM("batch"."currentQuantity"), 0) > 0',
        );
      }

      if (filters?.outOfStock) {
        countQueryBuilder.andHaving(
          'COALESCE(SUM("batch"."currentQuantity"), 0) = 0',
        );
      }

      if (filters?.nearExpiry) {
        const nearExpiryDate = new Date();
        nearExpiryDate.setDate(nearExpiryDate.getDate() + 30);

        countQueryBuilder.andWhere(
          `EXISTS (
            SELECT 1 FROM inventory_batches b2 
            WHERE b2.product_id = product.id 
              AND b2.organization_id = :organizationId 
              AND b2.status = :batchStatus
              AND b2."expirationDate" IS NOT NULL
              AND b2."expirationDate" <= :nearExpiryDate 
              AND b2."expirationDate" > CURRENT_DATE
              AND b2.deleted_at IS NULL
          )`,
          { nearExpiryDate },
        );
      }

      if (filters?.expired) {
        countQueryBuilder.andWhere(
          `EXISTS (
            SELECT 1 FROM inventory_batches b2 
            WHERE b2.product_id = product.id 
              AND b2.organization_id = :organizationId 
              AND b2.status = :batchStatus
              AND b2."expirationDate" IS NOT NULL
              AND b2."expirationDate" < CURRENT_DATE
              AND b2.deleted_at IS NULL
          )`,
        );
      }

      const [balances, countResult] = await Promise.all([
        queryBuilder
          .skip((page - 1) * limit)
          .take(limit)
          .getRawMany(),
        countQueryBuilder.getRawOne(),
      ]);

      console.log(
        '🔍 RAW BALANCES FROM QUERY:',
        JSON.stringify(balances, null, 2),
      );

      const total = parseInt(countResult?.count || '0', 10);
      const totalPages = Math.ceil(total / limit);

      console.log(
        `📊 Encontrados ${total} productos con lotes en almacén ${warehouseId}`,
      );

      return {
        data: balances.map((balance) => ({
          productId: balance.productid || 'unknown',
          productName: balance.productname || 'Sin nombre',
          productSku: balance.productsku || 'SIN-SKU',
          categoryName: balance.categoryname || 'Sin categoría',
          totalQuantity: parseFloat(balance.totalquantity) || 0,
          minStock: parseFloat(balance.minstock) || 0,
          averageCost: parseFloat(balance.averagecost) || 0,
          totalValue: parseFloat(balance.totalvalue) || 0,
          isLowStock:
            (parseFloat(balance.totalquantity) || 0) <=
              (parseFloat(balance.minstock) || 0) &&
            (parseFloat(balance.totalquantity) || 0) > 0,
          isOutOfStock: (parseFloat(balance.totalquantity) || 0) === 0,
        })),
        total,
        page,
        totalPages,
      };
    } catch (error) {
      console.error(
        `❌ Error filtrando inventario por almacén ${warehouseId}:`,
        error,
      );
      throw new BadRequestException(
        `Error getting inventory balances by warehouse: ${error.message}`,
      );
    }
  }

  /**
   * Determinar el costo unitario para stock inicial
   * Prioridad: 1) Precio de costo 2) Precio de venta 3) Valor por defecto
   */
  private getInitialStockCost(product: any): number {
    if (!product.prices || product.prices.length === 0) {
      console.log(
        `⚠️ Producto ${product.name} sin precios, usando costo por defecto: $1000`,
      );
      return 1000; // Valor por defecto
    }

    // Buscar precio de costo
    const costPrice = product.prices.find(
      (p) => p.type === 'cost' && p.status === 'active',
    );
    if (costPrice) {
      console.log(`💰 Usando precio de costo: $${costPrice.amount}`);
      return parseFloat(costPrice.amount.toString());
    }

    // Buscar precio de venta como fallback
    const salePrice = product.prices.find(
      (p) =>
        (p.type === 'sale' || p.type === 'price1') && p.status === 'active',
    );
    if (salePrice) {
      const estimatedCost = parseFloat(salePrice.amount.toString()) * 0.7; // 70% del precio de venta
      console.log(
        `🏷️ Usando 70% del precio de venta como costo estimado: $${estimatedCost}`,
      );
      return estimatedCost;
    }

    // Si solo hay precios sin tipo específico
    const firstPrice = product.prices.find((p) => p.status === 'active');
    if (firstPrice) {
      const estimatedCost = parseFloat(firstPrice.amount.toString()) * 0.7;
      console.log(
        `📊 Usando 70% del primer precio como costo estimado: $${estimatedCost}`,
      );
      return estimatedCost;
    }

    console.log(
      `⚠️ Producto ${product.name} con precios inválidos, usando costo por defecto: $1000`,
    );
    return 1000;
  }

  /**
   * Crear lote inicial para producto con stock sin lotes
   */
  async createInitialStockBatch(
    productId: string,
    quantity: number,
    unitCost: number,
    organizationId: string,
    userId: string,
    createdAt?: Date,
  ): Promise<{ movement: InventoryMovement; batch: InventoryBatch }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log(
        `🏗️ Creando lote inicial - Producto: ${productId}, Cantidad: ${quantity}, Costo: $${unitCost}`,
      );

      // Crear lote inicial
      const batch = queryRunner.manager.create(InventoryBatch, {
        batchNumber: await this.generateBatchNumber(
          organizationId,
          queryRunner,
        ),
        productId,
        organizationId,
        purchaseDate: createdAt || new Date(),
        originalQuantity: quantity,
        currentQuantity: quantity,
        reservedQuantity: 0,
        unitCost,
        totalCost: quantity * unitCost,
        remainingValue: quantity * unitCost,
        status: 'active' as any,
        metadata: {
          source: 'initial_stock',
          migration: true,
          note: 'Stock inicial del producto',
        },
      });

      const savedBatch = await queryRunner.manager.save(batch);
      console.log(`✅ Lote creado: ${savedBatch.batchNumber}`);

      // Crear movimiento de inventario
      const movement = queryRunner.manager.create(InventoryMovement, {
        movementNumber: await this.generateMovementNumber(
          organizationId,
          queryRunner,
        ),
        type: MovementType.INITIAL_STOCK,
        status: MovementStatus.CONFIRMED,
        productId,
        organizationId,
        createdById: userId,
        movementDate: createdAt || new Date(),
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        stockAfter: quantity,
        stockValueAfter: quantity * unitCost,
        referenceType: 'initial_stock',
        notes: 'Stock inicial del producto',
        metadata: {
          batchId: savedBatch.id,
          source: 'initial_stock_creation',
        },
      });

      const savedMovement = await queryRunner.manager.save(movement);
      console.log(`✅ Movimiento creado: ${savedMovement.movementNumber}`);

      // Crear movimiento del lote
      const batchMovement = queryRunner.manager.create(InventoryBatchMovement, {
        type: 'consume' as any, // Entrada inicial
        batchId: savedBatch.id,
        inventoryMovementId: savedMovement.id,
        organizationId,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        batchQuantityAfter: savedBatch.currentQuantity,
        batchValueAfter: savedBatch.remainingValue,
      });

      await queryRunner.manager.save(batchMovement);

      await queryRunner.commitTransaction();
      console.log(`🎉 Stock inicial creado exitosamente`);

      return { movement: savedMovement, batch: savedBatch };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(`❌ Error creando stock inicial:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Migrar productos existentes con stock pero sin lotes
   * SCRIPT DE MIGRACIÓN PROFESIONAL
   */
  async migrateProductsWithStock(
    organizationId: string,
    userId: string,
  ): Promise<{
    processed: number;
    migrated: number;
    skipped: number;
    errors: Array<{ productId: string; productName: string; error: string }>;
  }> {
    console.log(
      `🚀 INICIANDO MIGRACIÓN DE STOCK INICIAL - Organización: ${organizationId}`,
    );

    const results = {
      processed: 0,
      migrated: 0,
      skipped: 0,
      errors: [] as Array<{
        productId: string;
        productName: string;
        error: string;
      }>,
    };

    try {
      // Buscar productos con stock > 0
      const productsWithStock = await this.productRepository.find({
        where: {
          organizationId,
          stock: MoreThan(0),
        },
        relations: ['prices'],
        order: { createdAt: 'ASC' },
      });

      console.log(
        `📊 Encontrados ${productsWithStock.length} productos con stock > 0`,
      );

      for (const product of productsWithStock) {
        results.processed++;
        console.log(
          `\n🔍 Procesando: ${product.name} (${product.sku}) - Stock: ${product.stock}`,
        );

        try {
          // Verificar si ya tiene lotes
          const existingBatches = await this.batchRepository.count({
            where: {
              productId: product.id,
              organizationId,
              status: 'active' as any,
            },
          });

          if (existingBatches > 0) {
            console.log(
              `   ⏭️ Producto ya tiene ${existingBatches} lotes, omitiendo...`,
            );
            results.skipped++;
            continue;
          }

          // Determinar costo unitario
          const unitCost = this.getInitialStockCost(product);
          const quantity = parseFloat(product.stock.toString());

          // Crear lote inicial
          await this.createInitialStockBatch(
            product.id,
            quantity,
            unitCost,
            organizationId,
            userId,
            product.createdAt,
          );

          console.log(
            `   ✅ Migrado exitosamente - ${quantity} unidades a $${unitCost} c/u`,
          );
          results.migrated++;
        } catch (error) {
          console.error(
            `   ❌ Error migrando producto ${product.name}:`,
            error,
          );
          results.errors.push({
            productId: product.id,
            productName: product.name,
            error: error.message || error.toString(),
          });
        }
      }

      console.log(`\n🎉 MIGRACIÓN COMPLETADA:`);
      console.log(`   📊 Procesados: ${results.processed}`);
      console.log(`   ✅ Migrados: ${results.migrated}`);
      console.log(`   ⏭️ Omitidos: ${results.skipped}`);
      console.log(`   ❌ Errores: ${results.errors.length}`);

      if (results.errors.length > 0) {
        console.log(`\n📋 ERRORES DETALLADOS:`);
        results.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.productName}: ${error.error}`);
        });
      }

      return results;
    } catch (error) {
      console.error(`❌ Error general en migración:`, error);
      throw error;
    }
  }

  // Método para obtener balances de inventario
  async getInventoryBalances(
    organizationId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      search?: string;
      categoryId?: string;
      warehouseId?: string;
      lowStock?: boolean;
      outOfStock?: boolean;
      nearExpiry?: boolean;
      expired?: boolean;
    },
    sortBy: string = 'productName',
    sortOrder: string = 'asc',
  ) {
    try {
      // Si hay filtro por almacén, necesitamos una consulta diferente que considere los movimientos
      if (filters?.warehouseId) {
        return await this.getInventoryBalancesByWarehouse(
          organizationId,
          filters.warehouseId,
          page,
          limit,
          filters,
          sortBy,
          sortOrder,
        );
      }

      // Consulta normal sin filtro de almacén
      const queryBuilder = this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.category', 'category')
        .leftJoin(
          'inventory_batches',
          'batch',
          'batch.product_id = product.id AND batch.organization_id = :organizationId AND batch.status = :batchStatus AND batch.deleted_at IS NULL',
          { organizationId, batchStatus: 'active' },
        )
        .select([
          '"product"."id" as productId',
          '"product"."name" as productName',
          '"product"."sku" as productSku',
          '"product"."minStock" as minStock',
          '"category"."name" as categoryName',
          'COALESCE(SUM("batch"."currentQuantity"), 0) as totalQuantity',
          'COALESCE(AVG("batch"."unitCost"), 0) as averageCost',
          'COALESCE(SUM("batch"."currentQuantity" * "batch"."unitCost"), 0) as totalValue',
        ])
        .where('"product"."organization_id" = :organizationId', {
          organizationId,
        })
        .andWhere('"product"."deleted_at" IS NULL')
        .groupBy(
          'product.id, product.name, product.sku, product.minStock, category.name',
        );

      if (filters?.search) {
        queryBuilder.andWhere(
          '("product"."name" ILIKE :search OR "product"."sku" ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      if (filters?.categoryId) {
        queryBuilder.andWhere('product.categoryId = :categoryId', {
          categoryId: filters.categoryId,
        });
      }

      if (filters?.lowStock) {
        // Use MAX to aggregate product.minStock (all values for a product are the same)
        // Excluir productos sin stock (cantidad = 0)
        queryBuilder.having(
          'COALESCE(SUM(batch.currentQuantity), 0) <= MAX(product.minStock) AND COALESCE(SUM(batch.currentQuantity), 0) > 0',
        );
      }

      if (filters?.outOfStock) {
        queryBuilder.having('COALESCE(SUM(batch.currentQuantity), 0) = 0');
      }

      if (filters?.nearExpiry) {
        const nearExpiryDate = new Date();
        nearExpiryDate.setDate(nearExpiryDate.getDate() + 30); // 30 días desde hoy

        // Solo productos que tienen al menos un lote que NO sea NULL y esté por vencer
        queryBuilder
          .andWhere('batch."expirationDate" IS NOT NULL')
          .having(
            'MIN(batch."expirationDate") <= :nearExpiryDate AND MIN(batch."expirationDate") > CURRENT_DATE',
            {
              nearExpiryDate: nearExpiryDate,
            },
          );
      }

      if (filters?.expired) {
        // Solo productos que tienen al menos un lote que NO sea NULL y esté vencido
        queryBuilder
          .andWhere('batch."expirationDate" IS NOT NULL')
          .having('MIN(batch."expirationDate") < CURRENT_DATE');
      }

      const orderDirection =
        sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      // Map sortBy values to actual database columns
      const sortFieldMap = {
        productName: '"product"."name"',
        productSku: '"product"."sku"',
        categoryName: '"category"."name"',
        totalQuantity: 'SUM("batch"."currentQuantity")',
        totalValue: 'SUM("batch"."currentQuantity" * "batch"."unitCost")',
        averageCost: 'AVG("batch"."unitCost")',
      };

      const actualSortField = sortFieldMap[sortBy] || '"product"."name"';
      queryBuilder.orderBy(actualSortField, orderDirection);

      // Crear consulta para contar productos únicos
      const countQuery = this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.category', 'category')
        .leftJoin(
          'inventory_batches',
          'batch',
          'batch.product_id = product.id AND batch.organization_id = :organizationId AND batch.status = :batchStatus AND batch.deleted_at IS NULL',
          { organizationId, batchStatus: 'active' },
        )
        .select('COUNT(DISTINCT "product"."id") as count')
        .where('"product"."organization_id" = :organizationId', {
          organizationId,
        })
        .andWhere('"product"."deleted_at" IS NULL');

      // Aplicar los mismos filtros de búsqueda y categoría
      if (filters?.search) {
        countQuery.andWhere(
          '("product"."name" ILIKE :search OR "product"."sku" ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      if (filters?.categoryId) {
        countQuery.andWhere('product.categoryId = :categoryId', {
          categoryId: filters.categoryId,
        });
      }

      // Los filtros de lowStock, outOfStock, etc. requieren GROUP BY y HAVING
      // así que para el count necesitamos una consulta más compleja
      let totalCount: number;
      if (
        filters?.lowStock ||
        filters?.outOfStock ||
        filters?.nearExpiry ||
        filters?.expired
      ) {
        // Para filtros que requieren HAVING, crear subconsulta
        const subQuery = this.productRepository
          .createQueryBuilder('product')
          .leftJoin('product.category', 'category')
          .leftJoin(
            'inventory_batches',
            'batch',
            'batch.product_id = product.id AND batch.organization_id = :organizationId AND batch.status = :batchStatus AND batch.deleted_at IS NULL',
            { organizationId, batchStatus: 'active' },
          )
          .select('product.id')
          .where('product.organization_id = :organizationId', {
            organizationId,
          })
          .andWhere('product.deleted_at IS NULL')
          .groupBy(
            'product.id, product.name, product.sku, product.minStock, category.name',
          );

        if (filters.search) {
          subQuery.andWhere(
            '("product"."name" ILIKE :search OR "product"."sku" ILIKE :search)',
            { search: `%${filters.search}%` },
          );
        }

        if (filters.categoryId) {
          subQuery.andWhere('product.categoryId = :categoryId', {
            categoryId: filters.categoryId,
          });
        }

        if (filters.lowStock) {
          subQuery.having(
            'COALESCE(SUM(batch.currentQuantity), 0) <= MAX(product.minStock) AND COALESCE(SUM(batch.currentQuantity), 0) > 0',
          );
        }

        if (filters.outOfStock) {
          subQuery.having('COALESCE(SUM(batch.currentQuantity), 0) = 0');
        }

        if (filters.nearExpiry) {
          subQuery
            .andWhere('batch."expirationDate" IS NOT NULL')
            .having(
              'MIN(batch."expirationDate") <= :nearExpiryDate AND MIN(batch."expirationDate") > CURRENT_DATE',
              {
                nearExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
              },
            );
        }

        if (filters.expired) {
          subQuery
            .andWhere('batch."expirationDate" IS NOT NULL')
            .having('MIN(batch."expirationDate") < CURRENT_DATE');
        }

        const subResults = await subQuery.getRawMany();
        totalCount = subResults.length;
      } else {
        // Para filtros simples, usar la consulta directa
        const countResult = await countQuery.getRawOne();
        totalCount = parseInt(countResult.count, 10);
      }

      const [balances] = await Promise.all([
        queryBuilder
          .skip((page - 1) * limit)
          .take(limit)
          .getRawMany(),
      ]);

      const total = totalCount;

      const totalPages = Math.ceil(total / limit);

      return {
        data: balances.map((balance) => ({
          productId: balance.productid || balance.productId || 'unknown',
          productName:
            balance.productname || balance.productName || 'Sin nombre',
          productSku: balance.productsku || balance.productSku || 'SIN-SKU',
          categoryName:
            balance.categoryname || balance.categoryName || 'Sin categoría',
          totalQuantity:
            parseFloat(balance.totalQuantity || balance.totalquantity) || 0,
          minStock: parseFloat(balance.minStock || balance.minstock) || 0,
          averageCost:
            parseFloat(balance.averageCost || balance.averagecost) || 0,
          totalValue: parseFloat(balance.totalValue || balance.totalvalue) || 0,
          isLowStock:
            (parseFloat(balance.totalQuantity || balance.totalquantity) || 0) <=
            (parseFloat(balance.minStock || balance.minstock) || 0),
          isOutOfStock:
            (parseFloat(balance.totalQuantity || balance.totalquantity) ||
              0) === 0,
        })),
        total,
        page,
        totalPages,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error getting inventory balances: ${error.message}`,
      );
    }
  }

  /**
   * Obtener estadísticas resumidas de inventario por almacén
   */
  async getWarehouseInventoryStats(
    organizationId: string,
    warehouseId: string,
  ): Promise<{
    totalProducts: number;
    totalValue: number;
    totalQuantity: number;
    lowStockProducts: number;
    outOfStockProducts: number;
  }> {
    try {
      console.log(`📊 Obteniendo estadísticas para almacén: ${warehouseId}`);

      // Consulta optimizada para obtener estadísticas resumidas
      const statsQuery = this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.category', 'category')
        .innerJoin(
          'inventory_batches',
          'batch',
          'batch.product_id = product.id AND batch.organization_id = :organizationId AND batch.status = :batchStatus AND batch.deleted_at IS NULL',
        )
        .innerJoin(
          'purchase_orders',
          'po',
          'po.id = batch.purchase_order_id AND po."warehouseId" = :warehouseId AND po.deleted_at IS NULL',
        )
        .select([
          'COUNT(DISTINCT "product"."id") as totalProducts',
          'COALESCE(SUM("batch"."currentQuantity"), 0) as totalQuantity',
          'COALESCE(SUM("batch"."currentQuantity" * "batch"."unitCost"), 0) as totalValue',
          'COUNT(DISTINCT CASE WHEN COALESCE("batch"."currentQuantity", 0) <= "product"."minStock" AND COALESCE("batch"."currentQuantity", 0) > 0 THEN "product"."id" END) as lowStockProducts',
          'COUNT(DISTINCT CASE WHEN COALESCE("batch"."currentQuantity", 0) = 0 THEN "product"."id" END) as outOfStockProducts',
        ])
        .where('"product"."organization_id" = :organizationId', {
          organizationId,
          batchStatus: 'active',
          warehouseId,
        })
        .andWhere('"product"."deleted_at" IS NULL');

      const result = await statsQuery.getRawOne();

      const stats = {
        totalProducts: parseInt(result.totalproducts) || 0,
        totalValue: parseFloat(result.totalvalue) || 0,
        totalQuantity: parseFloat(result.totalquantity) || 0,
        lowStockProducts: parseInt(result.lowstockproducts) || 0,
        outOfStockProducts: parseInt(result.outofstockproducts) || 0,
      };

      console.log(
        `✅ Estadísticas calculadas para almacén ${warehouseId}:`,
        stats,
      );

      return stats;
    } catch (error) {
      console.error(
        `❌ Error obteniendo estadísticas de almacén ${warehouseId}:`,
        error,
      );
      throw new BadRequestException(
        `Error getting warehouse inventory stats: ${error.message}`,
      );
    }
  }

  // ========================================
  // VALIDACIONES DE INTEGRIDAD DEL SISTEMA
  // ========================================

  /**
   * Validar integridad completa del inventario
   */
  async validateInventoryIntegrity(organizationId: string): Promise<{
    isValid: boolean;
    inconsistencies: Array<{
      productId: string;
      productName: string;
      productSku: string;
      productStock: number;
      batchStock: number;
      difference: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
    }>;
    summary: {
      totalProducts: number;
      consistentProducts: number;
      inconsistentProducts: number;
      totalStockValue: number;
      totalBatchValue: number;
    };
  }> {
    console.log(
      `🔍 Iniciando validación de integridad para organización: ${organizationId}`,
    );

    const inconsistencies = [];
    let totalProducts = 0;
    let consistentProducts = 0;
    let totalStockValue = 0;
    let totalBatchValue = 0;

    // Obtener todos los productos con sus datos de stock y lotes
    const query = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.stock as product_stock,
        COALESCE(SUM(ib."currentQuantity"), 0) as batch_stock,
        COALESCE(SUM(ib."remainingValue"), 0) as batch_value,
        p.stock * 1000 as estimated_stock_value
      FROM products p
      LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.status = 'active'
      WHERE p.organization_id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.sku, p.stock
      ORDER BY p.name
    `;

    const results = await this.dataSource.query(query, [organizationId]);

    for (const row of results) {
      totalProducts++;
      const productStock = parseFloat(row.product_stock) || 0;
      const batchStock = parseFloat(row.batch_stock) || 0;
      const difference = productStock - batchStock;
      const batchValue = parseFloat(row.batch_value) || 0;
      const estimatedStockValue = parseFloat(row.estimated_stock_value) || 0;

      totalStockValue += estimatedStockValue;
      totalBatchValue += batchValue;

      // Determinar si hay inconsistencia
      if (Math.abs(difference) < 0.01) {
        consistentProducts++;
      } else {
        // Categorizar la severidad
        let severity: 'low' | 'medium' | 'high' | 'critical';
        let recommendation: string;

        const percentageDifference =
          (Math.abs(difference) / Math.max(productStock, batchStock, 1)) * 100;

        if (Math.abs(difference) <= 1) {
          severity = 'low';
          recommendation = 'Diferencia mínima. Verificar redondeos.';
        } else if (Math.abs(difference) <= 5 || percentageDifference <= 10) {
          severity = 'medium';
          recommendation =
            'Diferencia moderada. Revisar movimientos recientes.';
        } else if (Math.abs(difference) <= 20 || percentageDifference <= 25) {
          severity = 'high';
          recommendation = 'Diferencia significativa. Requiere corrección.';
        } else {
          severity = 'critical';
          recommendation =
            'Diferencia crítica. Corrección inmediata requerida.';
        }

        inconsistencies.push({
          productId: row.product_id,
          productName: row.product_name,
          productSku: row.product_sku,
          productStock,
          batchStock,
          difference,
          severity,
          recommendation,
        });
      }
    }

    const isValid = inconsistencies.length === 0;

    console.log(
      `✅ Validación completada: ${consistentProducts}/${totalProducts} productos consistentes`,
    );

    return {
      isValid,
      inconsistencies,
      summary: {
        totalProducts,
        consistentProducts,
        inconsistentProducts: totalProducts - consistentProducts,
        totalStockValue,
        totalBatchValue,
      },
    };
  }

  /**
   * Corregir inconsistencias automáticamente
   */
  async fixInventoryInconsistencies(
    organizationId: string,
    createdById: string,
    options: {
      autoFix: boolean;
      maxDifferenceToFix: number;
      dryRun: boolean;
    } = { autoFix: true, maxDifferenceToFix: 100, dryRun: false },
  ): Promise<{
    fixed: number;
    skipped: number;
    errors: string[];
    actions: Array<{
      productId: string;
      productName: string;
      action: 'create_batch' | 'reduce_batches' | 'skip';
      difference: number;
      reason: string;
    }>;
  }> {
    console.log(
      `🛠️ Iniciando corrección de inconsistencias - Dry run: ${options.dryRun}`,
    );

    const validation = await this.validateInventoryIntegrity(organizationId);
    const actions = [];
    const errors = [];
    let fixed = 0;
    let skipped = 0;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    for (const inconsistency of validation.inconsistencies) {
      const { productId, productName, difference, severity } = inconsistency;

      // Decidir si debe corregirse automáticamente
      const shouldFix =
        options.autoFix &&
        Math.abs(difference) <= options.maxDifferenceToFix &&
        severity !== 'critical'; // Los críticos requieren revisión manual

      if (!shouldFix) {
        actions.push({
          productId,
          productName,
          action: 'skip',
          difference,
          reason: `Diferencia demasiado grande (${difference}) o severidad crítica`,
        });
        skipped++;
        continue;
      }

      try {
        if (!options.dryRun) {
          await queryRunner.startTransaction();
        }

        if (difference > 0) {
          // Producto tiene más stock que lotes - crear lote
          const action = {
            productId,
            productName,
            action: 'create_batch' as const,
            difference,
            reason: `Crear lote por diferencia de ${difference} unidades`,
          };
          actions.push(action);

          if (!options.dryRun) {
            await this.createAdjustmentBatch(
              productId,
              difference,
              organizationId,
              createdById,
              'Corrección automática de inconsistencia',
              queryRunner,
            );
          }
          fixed++;
        } else {
          // Lotes tienen más cantidad que el producto - reducir lotes
          const action = {
            productId,
            productName,
            action: 'reduce_batches' as const,
            difference,
            reason: `Reducir lotes por exceso de ${Math.abs(difference)} unidades`,
          };
          actions.push(action);

          if (!options.dryRun) {
            await this.reduceExcessBatches(
              productId,
              Math.abs(difference),
              organizationId,
              createdById,
              queryRunner,
            );
          }
          fixed++;
        }

        if (!options.dryRun) {
          await queryRunner.commitTransaction();
        }
      } catch (error) {
        if (!options.dryRun) {
          await queryRunner.rollbackTransaction();
        }

        errors.push(`Error corrigiendo ${productName}: ${error.message}`);
        console.error(`❌ Error corrigiendo ${productName}:`, error);

        // Convertir a skip
        actions[actions.length - 1] = {
          productId,
          productName,
          action: 'skip',
          difference,
          reason: `Error: ${error.message}`,
        };
        fixed--;
        skipped++;
      }
    }

    await queryRunner.release();

    console.log(
      `🎉 Corrección completada: ${fixed} corregidos, ${skipped} omitidos`,
    );

    return {
      fixed,
      skipped,
      errors,
      actions,
    };
  }

  /**
   * Crear lote de ajuste para diferencias positivas
   */
  private async createAdjustmentBatch(
    productId: string,
    quantity: number,
    organizationId: string,
    createdById: string,
    reason: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const batchNumber = await this.generateBatchNumber(
      organizationId,
      queryRunner,
    );
    const movementNumber = await this.generateMovementNumber(
      organizationId,
      queryRunner,
    );
    const unitCost = 1000; // Costo estimado
    const totalCost = quantity * unitCost;

    // Crear lote
    const batch = queryRunner.manager.create('InventoryBatch', {
      batchNumber,
      productId,
      organizationId,
      purchaseDate: new Date(),
      originalQuantity: quantity,
      currentQuantity: quantity,
      reservedQuantity: 0,
      unitCost,
      totalCost,
      remainingValue: totalCost,
      status: 'active',
      metadata: {
        source: 'automatic_correction',
        reason,
        correctionDate: new Date().toISOString(),
      },
    });

    await queryRunner.manager.save(batch);

    // Crear movimiento
    const movement = queryRunner.manager.create('InventoryMovement', {
      movementNumber,
      type: 'adjustment',
      status: 'confirmed',
      productId,
      organizationId,
      createdById,
      movementDate: new Date(),
      quantity,
      unitCost,
      totalCost,
      stockAfter: quantity, // Se recalculará con el trigger
      stockValueAfter: totalCost,
      referenceType: 'automatic_correction',
      notes: reason,
    });

    await queryRunner.manager.save(movement);
  }

  /**
   * Reducir lotes excesivos usando FIFO
   */
  private async reduceExcessBatches(
    productId: string,
    excessQuantity: number,
    organizationId: string,
    createdById: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    // Obtener lotes activos ordenados por FIFO
    const batches = await queryRunner.manager
      .createQueryBuilder('InventoryBatch', 'batch')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.status = :status', { status: 'active' })
      .andWhere('batch.currentQuantity > 0')
      .orderBy('batch.purchaseDate', 'ASC')
      .addOrderBy('batch.createdAt', 'ASC')
      .getMany();

    let remainingReduction = excessQuantity;

    for (const batch of batches) {
      if (remainingReduction <= 0) break;

      const reductionAmount = Math.min(
        batch.currentQuantity,
        remainingReduction,
      );
      const newQuantity = batch.currentQuantity - reductionAmount;

      // Actualizar lote
      await queryRunner.manager.update('InventoryBatch', batch.id, {
        currentQuantity: newQuantity,
        remainingValue: newQuantity * batch.unitCost,
        status: newQuantity === 0 ? 'depleted' : 'active',
        updatedAt: new Date(),
      });

      remainingReduction -= reductionAmount;
    }

    // Crear movimiento de ajuste
    const movementNumber = await this.generateMovementNumber(
      organizationId,
      queryRunner,
    );
    const movement = queryRunner.manager.create('InventoryMovement', {
      movementNumber,
      type: 'adjustment',
      status: 'confirmed',
      productId,
      organizationId,
      createdById,
      movementDate: new Date(),
      quantity: -excessQuantity, // Negativo porque es reducción
      unitCost: 1000,
      totalCost: -excessQuantity * 1000,
      stockAfter: 0, // Se recalculará con el trigger
      stockValueAfter: 0,
      referenceType: 'automatic_correction',
      notes: 'Reducción automática de exceso de lotes',
    });

    await queryRunner.manager.save(movement);
  }

  /**
   * Registrar transferencia entre almacenes
   * Crea dos movimientos: TRANSFER_OUT en origen y TRANSFER_IN en destino
   */
  async registerTransfer(
    productId: string,
    quantity: number,
    fromWarehouseId: string,
    toWarehouseId: string,
    organizationId: string,
    userId: string,
    notes?: string,
    unitCost?: number,
  ): Promise<{
    transferOut: InventoryMovement;
    transferIn: InventoryMovement;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el producto existe
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId, organizationId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Verificar stock disponible en almacén origen (específico por almacén)
      const availableStock = await this.getWarehouseStock(
        productId,
        fromWarehouseId,
        organizationId,
        queryRunner,
      );

      if (availableStock < quantity) {
        throw new BadRequestException(
          `Insufficient stock in origin warehouse. Available: ${availableStock}, Required: ${quantity}`,
        );
      }

      // Obtener costo unitario promedio del producto
      const avgCost = await this.calculateAverageCost(
        productId,
        organizationId,
        queryRunner,
      );
      const transferUnitCost = unitCost || avgCost || 0;

      // 1. Crear movimiento TRANSFER_OUT (salida del almacén origen)
      const transferOutMovement = queryRunner.manager.create(
        InventoryMovement,
        {
          movementNumber: await this.generateMovementNumber(
            organizationId,
            queryRunner,
          ),
          type: MovementType.TRANSFER_OUT,
          status: MovementStatus.CONFIRMED,
          productId,
          organizationId,
          createdById: userId,
          warehouseId: fromWarehouseId,
          movementDate: new Date(),
          quantity: Math.abs(quantity), // Siempre positivo, el signo se maneja en signedQuantity
          unitCost: transferUnitCost,
          totalCost: quantity * transferUnitCost,
          referenceType: 'transfer',
          notes: notes || `Transfer to warehouse: ${toWarehouseId}`,
          metadata: {
            transferType: 'out',
            originWarehouse: fromWarehouseId,
            destinationWarehouse: toWarehouseId,
            relatedTransfer: true,
          },
        },
      );

      // PASO 1: Simular el consumo FIFO para validación (sin modificar lotes)
      console.log(
        `🧪 SIMULANDO consumo FIFO para transferencia: ${quantity} unidades del producto ${productId}`,
      );
      const simulationResult = await this.simulateStockFifoConsumption(
        productId,
        quantity,
        organizationId,
        fromWarehouseId,
        queryRunner,
      );
      console.log(
        `✅ SIMULACIÓN exitosa: ${simulationResult.totalQuantityConsumed} unidades, costo promedio: ${simulationResult.averageCost}`,
      );

      // PASO 2: Crear y guardar el movimiento TRANSFER_OUT primero (triggers de validación pasarán)
      console.log(
        `📝 Creando movimiento TRANSFER_OUT antes de modificar lotes`,
      );

      // Calcular stock después del movimiento de salida usando la simulación
      const stockAfterOut =
        (await this.getCurrentStock(productId, organizationId, queryRunner)) -
        quantity;
      const stockValueAfterOut =
        (await this.calculateStockValue(
          productId,
          organizationId,
          queryRunner,
        )) - simulationResult.totalCost;

      transferOutMovement.stockAfter = stockAfterOut;
      transferOutMovement.stockValueAfter = stockValueAfterOut;

      // Guardar el movimiento ANTES de modificar los lotes
      await queryRunner.manager.save(transferOutMovement);
      console.log(
        `✅ Movimiento TRANSFER_OUT guardado exitosamente: ${transferOutMovement.movementNumber}`,
      );

      // PASO 3: Ahora sí procesar FIFO real para el almacén origen (modificar lotes)
      console.log(`🔄 Ejecutando consumo FIFO real para transferencia`);
      const fifoResult = await this.consumeStockFifoByWarehouse(
        productId,
        quantity,
        organizationId,
        fromWarehouseId,
        queryRunner,
      );
      console.log(
        `✅ Consumo FIFO real completado: ${fifoResult.totalQuantityConsumed} unidades procesadas`,
      );

      // 2. Crear movimiento TRANSFER_IN (entrada al almacén destino)
      const transferInMovement = queryRunner.manager.create(InventoryMovement, {
        movementNumber: await this.generateMovementNumber(
          organizationId,
          queryRunner,
        ),
        type: MovementType.TRANSFER_IN,
        status: MovementStatus.CONFIRMED,
        productId,
        organizationId,
        createdById: userId,
        warehouseId: toWarehouseId,
        movementDate: new Date(),
        quantity: Math.abs(quantity), // Siempre positivo
        unitCost: transferUnitCost,
        totalCost: quantity * transferUnitCost,
        referenceType: 'transfer',
        notes: notes || `Transfer from warehouse: ${fromWarehouseId}`,
        metadata: {
          transferType: 'in',
          originWarehouse: fromWarehouseId,
          destinationWarehouse: toWarehouseId,
          relatedTransfer: true,
        },
      });

      // Crear nuevo lote en el almacén destino
      const destinationBatch = queryRunner.manager.create(InventoryBatch, {
        batchNumber: await this.generateBatchNumber(
          organizationId,
          queryRunner,
        ),
        productId,
        organizationId,
        purchaseDate: new Date(),
        originalQuantity: quantity,
        currentQuantity: quantity,
        reservedQuantity: 0,
        unitCost: transferUnitCost,
        totalCost: quantity * transferUnitCost,
        remainingValue: quantity * transferUnitCost,
        status: BatchStatus.ACTIVE,
        warehouseId: toWarehouseId,
        metadata: {
          transferFrom: fromWarehouseId,
          transferMovementId: transferOutMovement.id,
        },
      });

      await queryRunner.manager.save(destinationBatch);

      // Calcular stock después del movimiento de entrada
      const stockAfterIn = stockAfterOut + quantity;
      const stockValueAfterIn =
        stockValueAfterOut + quantity * transferUnitCost;

      transferInMovement.stockAfter = stockAfterIn;
      transferInMovement.stockValueAfter = stockValueAfterIn;

      await queryRunner.manager.save(transferInMovement);

      // Crear movimientos de lote para ambos movimientos
      for (const batchConsumption of fifoResult.batches) {
        await queryRunner.manager.save(
          queryRunner.manager.create(InventoryBatchMovement, {
            inventoryMovementId: transferOutMovement.id,
            batchId: batchConsumption.batchId,
            type: BatchMovementType.OUTGOING,
            quantity: batchConsumption.quantityConsumed,
            unitCost: batchConsumption.unitCost,
            totalCost: batchConsumption.totalCost,
            organizationId,
            movementDate: new Date(),
            batchQuantityAfter: 0, // Se calculará después
            batchValueAfter: 0, // Se calculará después
          }),
        );
      }

      await queryRunner.manager.save(
        queryRunner.manager.create(InventoryBatchMovement, {
          inventoryMovementId: transferInMovement.id,
          batchId: destinationBatch.id,
          type: BatchMovementType.INCOMING,
          quantity: quantity,
          unitCost: transferUnitCost,
          totalCost: quantity * transferUnitCost,
          organizationId,
          movementDate: new Date(),
          batchQuantityAfter: quantity,
          batchValueAfter: quantity * transferUnitCost,
        }),
      );

      await queryRunner.commitTransaction();

      console.log(
        `✅ Transfer completed: ${quantity} units from warehouse ${fromWarehouseId} to ${toWarehouseId}`,
      );

      return {
        transferOut: transferOutMovement,
        transferIn: transferInMovement,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('❌ Transfer failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtener stock específico de un almacén
   */
  private async getWarehouseStock(
    productId: string,
    warehouseId: string,
    organizationId: string,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const manager = queryRunner?.manager || this.batchRepository.manager;

    const result = await manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .select('COALESCE(SUM(batch.currentQuantity), 0)', 'totalStock')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.warehouseId = :warehouseId', { warehouseId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .getRawOne();

    return parseFloat(result?.totalStock || '0');
  }

  /**
   * Calcular costo unitario promedio de un producto
   */
  private async calculateAverageCost(
    productId: string,
    organizationId: string,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const manager = queryRunner?.manager || this.batchRepository.manager;

    const result = await manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .select('AVG(batch.unitCost)', 'avgCost')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .andWhere('batch.currentQuantity > 0')
      .getRawOne();

    return parseFloat(result?.avgCost || '0');
  }

  /**
   * Consumir stock usando FIFO filtrado por almacén
   */
  /**
   * Simula el consumo FIFO sin modificar los lotes (para validación)
   */
  private async simulateStockFifoConsumption(
    productId: string,
    quantityToConsume: number,
    organizationId: string,
    warehouseId: string,
    queryRunner: QueryRunner,
  ): Promise<FifoConsumptionResult> {
    // Obtener lotes activos con stock disponible ordenados por fecha de compra (FIFO)
    const activeBatches = await queryRunner.manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.warehouseId = :warehouseId', { warehouseId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .andWhere('batch.currentQuantity > 0')
      .orderBy('batch.purchaseDate', 'ASC')
      .addOrderBy('batch.createdAt', 'ASC')
      .getMany();

    if (activeBatches.length === 0) {
      throw new Error(
        `No hay lotes activos disponibles para el producto ${productId} en el almacén ${warehouseId}`,
      );
    }

    // Verificar que hay suficiente stock
    const totalAvailable = activeBatches.reduce(
      (sum, batch) => sum + batch.currentQuantity,
      0,
    );
    if (totalAvailable < quantityToConsume) {
      throw new Error(
        `Stock insuficiente en almacén ${warehouseId}. Disponible: ${totalAvailable}, Requerido: ${quantityToConsume}`,
      );
    }

    // SIMULAR el consumo sin modificar los lotes
    const consumptionDetails: FifoConsumptionResult['batches'] = [];
    let remainingToConsume = quantityToConsume;
    let totalCost = 0;

    for (const batch of activeBatches) {
      if (remainingToConsume <= 0) break;

      const quantityFromThisBatch = Math.min(
        batch.currentQuantity,
        remainingToConsume,
      );
      const costFromThisBatch = quantityFromThisBatch * batch.unitCost;

      // Solo registrar el detalle, SIN modificar el lote
      consumptionDetails.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantityConsumed: quantityFromThisBatch,
        unitCost: batch.unitCost,
        totalCost: costFromThisBatch,
        purchaseDate: batch.purchaseDate,
      });

      totalCost += costFromThisBatch;
      remainingToConsume -= quantityFromThisBatch;
    }

    return {
      batches: consumptionDetails,
      totalQuantityConsumed: quantityToConsume,
      totalCost,
      averageCost: totalCost / quantityToConsume,
    };
  }

  private async consumeStockFifoByWarehouse(
    productId: string,
    quantityToConsume: number,
    organizationId: string,
    warehouseId: string,
    queryRunner: QueryRunner,
  ): Promise<FifoConsumptionResult> {
    // Obtener lotes activos con stock disponible ordenados por fecha de compra (FIFO)
    const activeBatches = await queryRunner.manager
      .createQueryBuilder(InventoryBatch, 'batch')
      .where('batch.productId = :productId', { productId })
      .andWhere('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.warehouseId = :warehouseId', { warehouseId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .andWhere('batch.currentQuantity > 0')
      .orderBy('batch.purchaseDate', 'ASC')
      .addOrderBy('batch.createdAt', 'ASC')
      .getMany();

    if (activeBatches.length === 0) {
      throw new Error(
        `No hay lotes activos disponibles para el producto ${productId} en el almacén ${warehouseId}`,
      );
    }

    // Verificar que hay suficiente stock
    const totalAvailable = activeBatches.reduce(
      (sum, batch) => sum + batch.currentQuantity,
      0,
    );
    if (totalAvailable < quantityToConsume) {
      throw new Error(
        `Stock insuficiente en almacén ${warehouseId}. Disponible: ${totalAvailable}, Requerido: ${quantityToConsume}`,
      );
    }

    const consumptionDetails: FifoConsumptionResult['batches'] = [];
    let remainingToConsume = quantityToConsume;
    let totalCost = 0;

    for (const batch of activeBatches) {
      if (remainingToConsume <= 0) break;

      const quantityFromThisBatch = Math.min(
        batch.currentQuantity,
        remainingToConsume,
      );
      const costFromThisBatch = quantityFromThisBatch * batch.unitCost;

      // Actualizar el lote
      batch.currentQuantity -= quantityFromThisBatch;
      batch.remainingValue = batch.currentQuantity * batch.unitCost;

      if (batch.currentQuantity === 0) {
        batch.status = BatchStatus.DEPLETED;
      }

      await queryRunner.manager.save(batch);

      // Registrar el detalle del consumo
      consumptionDetails.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantityConsumed: quantityFromThisBatch,
        unitCost: batch.unitCost,
        totalCost: costFromThisBatch,
        purchaseDate: batch.purchaseDate,
      });

      totalCost += costFromThisBatch;
      remainingToConsume -= quantityFromThisBatch;
    }

    return {
      batches: consumptionDetails,
      totalQuantityConsumed: quantityToConsume,
      totalCost,
      averageCost: totalCost / quantityToConsume,
    };
  }

  /**
   * Monitoreo continuo de integridad
   */
  async scheduleIntegrityCheck(organizationId: string): Promise<void> {
    console.log(
      `📊 Programando chequeo de integridad para organización: ${organizationId}`,
    );

    // Esta función puede ser llamada por un cron job
    const validation = await this.validateInventoryIntegrity(organizationId);

    if (!validation.isValid) {
      console.warn(
        `⚠️ Se detectaron ${validation.inconsistencies.length} inconsistencias en la organización ${organizationId}`,
      );

      // Aquí podrías enviar notificaciones, emails, etc.
      const criticalIssues = validation.inconsistencies.filter(
        (i) => i.severity === 'critical',
      );
      if (criticalIssues.length > 0) {
        console.error(
          `🚨 ${criticalIssues.length} inconsistencias críticas detectadas!`,
        );
        // Enviar alerta inmediata
      }
    }
  }
}
