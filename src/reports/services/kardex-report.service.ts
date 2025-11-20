import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, LessThanOrEqual } from 'typeorm';
import {
  InventoryMovement,
  MovementType,
} from '../../inventory/entities/inventory-movement.entity';
import { InventoryBatch } from '../../inventory/entities/inventory-batch.entity';
import { InventoryBatchMovement } from '../../inventory/entities/inventory-batch-movement.entity';
import { Product } from '../../products/entities/product.entity';

export interface KardexEntry {
  date: Date;
  movementNumber: string;
  movementType: MovementType;
  referenceType?: string;
  referenceNumber?: string;
  description: string;

  // Cantidades
  entryQuantity: number;
  exitQuantity: number;
  balance: number;

  // Costos
  unitCost: number;
  entryCost: number;
  exitCost: number;
  balanceValue: number;

  // Precios (para ventas)
  unitPrice?: number;
  totalPrice?: number;

  // Metadatos
  createdBy: string;
  notes?: string;
}

export interface KardexReport {
  product: {
    id: string;
    name: string;
    sku: string;
    categoryName?: string;
  };

  period: {
    startDate: Date;
    endDate: Date;
  };

  initialBalance: {
    quantity: number;
    value: number;
    averageCost: number;
  };

  movements: KardexEntry[];

  finalBalance: {
    quantity: number;
    value: number;
    averageCost: number;
  };

  summary: {
    totalEntries: number;
    totalExits: number;
    totalPurchases: number;
    totalSales: number;
    averageUnitCost: number;
    totalValue: number;
  };

  batchDetails?: Array<{
    batchNumber: string;
    purchaseDate: Date;
    quantity: number;
    unitCost: number;
    totalValue: number;
    daysInInventory: number;
  }>;
}

export interface MovementSummary {
  period: { startDate: Date; endDate: Date };
  totalMovements: number;

  byType: {
    purchases: { count: number; quantity: number; value: number };
    sales: { count: number; quantity: number; value: number };
    adjustments: { count: number; quantity: number; value: number };
    transfers: { count: number; quantity: number; value: number };
    returns: { count: number; quantity: number; value: number };
    other: { count: number; quantity: number; value: number };
  };

  topProducts: Array<{
    productId: string;
    productName: string;
    movementsCount: number;
    totalQuantity: number;
    totalValue: number;
  }>;
}

@Injectable()
export class KardexReportService {
  constructor(
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(InventoryBatch)
    private batchRepository: Repository<InventoryBatch>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Generar Kardex completo de un producto
   */
  async getProductKardex(
    productId: string,
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
    includeBatchDetails: boolean = false,
  ): Promise<KardexReport> {
    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: productId, organizationId },
      relations: ['category'],
    });

    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // Fechas por defecto
    const defaultEndDate = endDate || new Date();
    const defaultStartDate =
      startDate || new Date(defaultEndDate.getFullYear(), 0, 1); // Inicio del año

    // Debug: Log de consulta kardex
    console.log(
      `🔍 KARDEX DEBUG - Product: ${productId}, Period: ${defaultStartDate.toISOString()} to ${defaultEndDate.toISOString()}`,
    );

    // Crear fecha de inicio del día para cálculos consistentes
    const startOfQueryDay = new Date(defaultStartDate);
    startOfQueryDay.setHours(0, 0, 0, 0);

    // Obtener balance inicial
    let initialBalance = await this.getInitialBalance(
      productId,
      organizationId,
      startOfQueryDay,
    );

    console.log(
      `📊 KARDEX - Initial Balance: ${JSON.stringify(initialBalance)}`,
    );

    // ✅ CORREGIDO: Obtener movimientos del período desde inicio del día
    const endOfDay = new Date(defaultEndDate);
    endOfDay.setHours(23, 59, 59, 999); // Final del día filtrado

    const movements = await this.movementRepository.find({
      where: {
        productId,
        organizationId,
        movementDate: Between(startOfQueryDay, endOfDay),
      },
      relations: ['createdBy'],
      order: {
        movementDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    // Convertir movimientos a entradas de kardex
    const kardexEntries: KardexEntry[] = [];
    let runningBalance = initialBalance.quantity;
    let runningValue = initialBalance.value;

    for (const movement of movements) {
      const isEntry = movement.quantity > 0;
      const absQuantity = Math.abs(movement.quantity);

      // Actualizar balances
      const quantityChange = parseFloat(movement.quantity.toString());
      const costChange = parseFloat((movement.totalCost || 0).toString());

      runningBalance += quantityChange;
      // Para ventas (cantidad negativa), el costo también debe ser negativo
      runningValue +=
        quantityChange < 0 ? -Math.abs(costChange) : Math.abs(costChange);

      const entry: KardexEntry = {
        date: movement.movementDate,
        movementNumber: movement.movementNumber,
        movementType: movement.type,
        referenceType: movement.referenceType,
        referenceNumber: movement.referenceNumber,
        description: this.getMovementDescription(movement),

        entryQuantity: isEntry ? absQuantity : 0,
        exitQuantity: isEntry ? 0 : absQuantity,
        balance: parseFloat(runningBalance.toFixed(2)),

        unitCost: parseFloat(Math.abs(movement.unitCost || 0).toString()),
        entryCost: isEntry
          ? parseFloat(Math.abs(movement.totalCost || 0).toString())
          : 0,
        exitCost: isEntry
          ? 0
          : parseFloat(Math.abs(movement.totalCost || 0).toString()),
        balanceValue: parseFloat(runningValue.toFixed(2)),

        unitPrice: movement.unitPrice
          ? parseFloat(movement.unitPrice.toString())
          : null,
        totalPrice: movement.totalPrice
          ? parseFloat(movement.totalPrice.toString())
          : null,

        createdBy: (movement.performedBy as any)?.name || 'System',
        notes: movement.notes,
      };

      kardexEntries.push(entry);
    }

    // Obtener detalles de lotes si se solicita
    let batchDetails: KardexReport['batchDetails'];
    if (includeBatchDetails) {
      batchDetails = await this.getCurrentBatchDetails(
        productId,
        organizationId,
      );
    }

    // Calcular resumen
    const summary = this.calculateSummary(kardexEntries);

    // Validar balance final con lotes activos actuales
    let finalBalance = {
      quantity: runningBalance,
      value: runningValue,
      averageCost: runningBalance > 0 ? runningValue / runningBalance : 0,
    };

    // Si no hay movimientos en el período pero hay lotes activos,
    // el balance final debería ser igual al inicial
    if (kardexEntries.length === 0 && batchDetails && batchDetails.length > 0) {
      console.log(
        `📊 No movements in period, using batch data for final balance - Product: ${productId}`,
      );
      const currentBatchQuantity = batchDetails.reduce(
        (sum, batch) => sum + parseFloat(batch.quantity.toString()),
        0,
      );
      const currentBatchValue = batchDetails.reduce(
        (sum, batch) => sum + parseFloat(batch.totalValue.toString()),
        0,
      );

      finalBalance = {
        quantity: currentBatchQuantity,
        value: currentBatchValue,
        averageCost:
          currentBatchQuantity > 0
            ? currentBatchValue / currentBatchQuantity
            : 0,
      };

      // Si el balance inicial era cero pero tenemos lotes, corregir el balance inicial también
      if (initialBalance.quantity === 0 && currentBatchQuantity > 0) {
        console.log(
          `📊 Correcting initial balance from batches - Product: ${productId}`,
        );
        initialBalance = {
          quantity: currentBatchQuantity,
          value: currentBatchValue,
          averageCost:
            currentBatchQuantity > 0
              ? currentBatchValue / currentBatchQuantity
              : 0,
        };
      }
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryName: product.category?.name,
      },

      period: {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      },

      initialBalance,
      movements: kardexEntries,

      finalBalance,

      summary,
      batchDetails,
    };
  }

  /**
   * Resumen de movimientos por período
   */
  async getMovementSummary(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<MovementSummary> {
    const defaultEndDate = endDate || new Date();
    const defaultStartDate =
      startDate ||
      new Date(defaultEndDate.getFullYear(), defaultEndDate.getMonth(), 1);

    const movements = await this.movementRepository.find({
      where: {
        organizationId,
        movementDate: Between(defaultStartDate, defaultEndDate),
      },
      relations: ['product'],
    });

    const summary: MovementSummary = {
      period: { startDate: defaultStartDate, endDate: defaultEndDate },
      totalMovements: movements.length,

      byType: {
        purchases: { count: 0, quantity: 0, value: 0 },
        sales: { count: 0, quantity: 0, value: 0 },
        adjustments: { count: 0, quantity: 0, value: 0 },
        transfers: { count: 0, quantity: 0, value: 0 },
        returns: { count: 0, quantity: 0, value: 0 },
        other: { count: 0, quantity: 0, value: 0 },
      },

      topProducts: [],
    };

    // Agrupar por tipo de movimiento
    movements.forEach((movement) => {
      const absQuantity = Math.abs(movement.quantity);
      const absValue = Math.abs(movement.totalCost || 0);

      let category: keyof typeof summary.byType;

      switch (movement.type) {
        case MovementType.PURCHASE:
          category = 'purchases';
          break;
        case MovementType.SALE:
          category = 'sales';
          break;
        case MovementType.ADJUSTMENT:
          category = 'adjustments';
          break;
        case MovementType.TRANSFER_IN:
        case MovementType.TRANSFER_OUT:
          category = 'transfers';
          break;
        case MovementType.RETURN_IN:
        case MovementType.RETURN_OUT:
          category = 'returns';
          break;
        default:
          category = 'other';
      }

      summary.byType[category].count++;
      summary.byType[category].quantity += absQuantity;
      summary.byType[category].value += absValue;
    });

    // Top productos por actividad
    const productActivity = new Map<
      string,
      {
        productName: string;
        movementsCount: number;
        totalQuantity: number;
        totalValue: number;
      }
    >();

    movements.forEach((movement) => {
      const productId = movement.productId;
      const productName = movement.product?.name || 'Unknown';

      if (!productActivity.has(productId)) {
        productActivity.set(productId, {
          productName,
          movementsCount: 0,
          totalQuantity: 0,
          totalValue: 0,
        });
      }

      const activity = productActivity.get(productId)!;
      activity.movementsCount++;
      activity.totalQuantity += Math.abs(movement.quantity);
      activity.totalValue += Math.abs(movement.totalCost || 0);
    });

    summary.topProducts = Array.from(productActivity.entries())
      .map(([productId, activity]) => ({
        productId,
        ...activity,
      }))
      .sort((a, b) => b.movementsCount - a.movementsCount)
      .slice(0, 10);

    return summary;
  }

  /**
   * Kardex resumido para múltiples productos
   */
  async getMultiProductKardex(
    productIds: string[],
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    Array<{
      productId: string;
      productName: string;
      initialQuantity: number;
      finalQuantity: number;
      totalEntries: number;
      totalExits: number;
      averageCost: number;
    }>
  > {
    const results = [];

    for (const productId of productIds) {
      try {
        const kardex = await this.getProductKardex(
          productId,
          organizationId,
          startDate,
          endDate,
          false,
        );

        results.push({
          productId: kardex.product.id,
          productName: kardex.product.name,
          initialQuantity: kardex.initialBalance.quantity,
          finalQuantity: kardex.finalBalance.quantity,
          totalEntries: kardex.summary.totalEntries,
          totalExits: kardex.summary.totalExits,
          averageCost: kardex.finalBalance.averageCost,
        });
      } catch (error) {
        console.error(
          `Error processing kardex for product ${productId}:`,
          error,
        );
      }
    }

    return results;
  }

  /**
   * Obtener balance inicial al comienzo del período de consulta
   * ✅ CORREGIDO: Lógica mejorada para calcular saldo inicial correcto
   */
  private async getInitialBalance(
    productId: string,
    organizationId: string,
    startDate: Date,
  ): Promise<{ quantity: number; value: number; averageCost: number }> {
    console.log(
      `🔍 Calculando saldo inicial para producto ${productId} desde ${startDate.toISOString()}`,
    );

    // ✅ MÉTODO CORREGIDO: Incluir movimientos hasta el inicio del día filtrado
    // Para kardex, el saldo inicial debe incluir TODO hasta el comienzo del día
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0); // Inicio del día de la fecha filtrada

    const previousMovements = await this.movementRepository.find({
      where: {
        productId,
        organizationId,
        movementDate: LessThan(startOfDay), // Movimientos antes del día filtrado
      },
      order: {
        movementDate: 'ASC',
      },
    });

    let movementQuantity = 0;
    let movementValue = 0;

    // Calcular balance acumulado de movimientos anteriores
    previousMovements.forEach((movement) => {
      movementQuantity += parseFloat(movement.quantity.toString());
      movementValue += parseFloat((movement.totalCost || 0).toString());
    });

    console.log(
      `📊 Balance por movimientos anteriores: ${movementQuantity} unidades, valor: ${movementValue}`,
    );

    // ✅ VERIFICACIÓN: Validar con lotes activos que fueron creados antes del día filtrado
    const activeBatchesBeforePeriod = await this.batchRepository.find({
      where: {
        productId,
        organizationId,
        status: 'active' as any,
        purchaseDate: LessThan(startOfDay), // Solo lotes creados antes del día filtrado
      },
    });

    let batchQuantityBefore = 0;
    let batchValueBefore = 0;

    if (activeBatchesBeforePeriod.length > 0) {
      batchQuantityBefore = activeBatchesBeforePeriod.reduce(
        (sum, batch) => sum + parseFloat(batch.currentQuantity.toString()),
        0,
      );
      batchValueBefore = activeBatchesBeforePeriod.reduce(
        (sum, batch) => sum + parseFloat(batch.remainingValue.toString()),
        0,
      );

      console.log(
        `📦 Lotes activos antes del período: ${batchQuantityBefore} unidades, valor: ${batchValueBefore}`,
      );
    }

    // ✅ DECISIÓN LÓGICA:
    // 1. Si hay movimientos anteriores, usar movimientos como fuente de verdad
    // 2. Si no hay movimientos pero SÍ lotes antes del período, usar lotes
    // 3. Si no hay nada anterior al período, saldo inicial = 0

    if (previousMovements.length > 0) {
      // Usar movimientos como fuente principal
      console.log(
        `✅ Usando movimientos como fuente: ${movementQuantity} unidades`,
      );

      // Validar consistencia con lotes si existen
      if (activeBatchesBeforePeriod.length > 0) {
        const discrepancy = Math.abs(movementQuantity - batchQuantityBefore);
        if (discrepancy > 0.01) {
          console.warn(
            `⚠️ Inconsistencia detectada - Movimientos: ${movementQuantity}, Lotes: ${batchQuantityBefore}`,
          );
          // En caso de inconsistencia, preferir lotes por ser más confiables
          return {
            quantity: Math.max(0, batchQuantityBefore),
            value: Math.max(0, batchValueBefore),
            averageCost:
              batchQuantityBefore > 0
                ? batchValueBefore / batchQuantityBefore
                : 0,
          };
        }
      }

      return {
        quantity: Math.max(0, movementQuantity),
        value: Math.max(0, movementValue),
        averageCost:
          movementQuantity > 0 ? movementValue / movementQuantity : 0,
      };
    } else if (activeBatchesBeforePeriod.length > 0) {
      // No hay movimientos anteriores, pero sí lotes anteriores
      console.log(
        `✅ Usando lotes como fuente: ${batchQuantityBefore} unidades`,
      );
      return {
        quantity: Math.max(0, batchQuantityBefore),
        value: Math.max(0, batchValueBefore),
        averageCost:
          batchQuantityBefore > 0 ? batchValueBefore / batchQuantityBefore : 0,
      };
    } else {
      // ✅ CASO CORRECTO: No hay nada antes del período, saldo inicial = 0
      console.log(
        `✅ No hay movimientos ni lotes antes del período - Saldo inicial: 0`,
      );
      return {
        quantity: 0,
        value: 0,
        averageCost: 0,
      };
    }
  }

  /**
   * Obtener detalles actuales de lotes
   */
  private async getCurrentBatchDetails(
    productId: string,
    organizationId: string,
  ): Promise<
    Array<{
      batchNumber: string;
      purchaseDate: Date;
      quantity: number;
      unitCost: number;
      totalValue: number;
      daysInInventory: number;
    }>
  > {
    const batches = await this.batchRepository.find({
      where: {
        productId,
        organizationId,
        status: 'active' as any,
      },
      order: {
        purchaseDate: 'ASC',
      },
    });

    const now = new Date();

    return batches.map((batch) => ({
      batchNumber: batch.batchNumber,
      purchaseDate: batch.purchaseDate,
      quantity: batch.currentQuantity,
      unitCost: batch.unitCost,
      totalValue: batch.remainingValue,
      daysInInventory: Math.floor(
        (now.getTime() - batch.purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  /**
   * Generar descripción del movimiento
   */
  private getMovementDescription(movement: InventoryMovement): string {
    const typeDescriptions = {
      [MovementType.PURCHASE]: 'Compra',
      [MovementType.SALE]: 'Venta',
      [MovementType.ADJUSTMENT]: 'Ajuste de inventario',
      [MovementType.TRANSFER_IN]: 'Transferencia entrada',
      [MovementType.TRANSFER_OUT]: 'Transferencia salida',
      [MovementType.RETURN_IN]: 'Devolución entrada',
      [MovementType.RETURN_OUT]: 'Devolución salida',
      [MovementType.WASTE]: 'Desperdicio/Merma',
      [MovementType.PRODUCTION]: 'Producción',
    };

    let description = typeDescriptions[movement.type] || 'Movimiento';

    if (movement.referenceNumber) {
      description += ` - ${movement.referenceNumber}`;
    }

    return description;
  }

  /**
   * Calcular resumen del kardex
   */
  private calculateSummary(entries: KardexEntry[]): KardexReport['summary'] {
    let totalEntries = 0;
    let totalExits = 0;
    let totalPurchases = 0;
    let totalSales = 0; // Ahora será el costo de las salidas, no el precio de venta
    let totalValue = 0;
    let totalCostQuantity = 0;

    entries.forEach((entry) => {
      totalEntries += entry.entryQuantity;
      totalExits += entry.exitQuantity;

      // Para compras, sumar el costo de entrada
      if (entry.entryQuantity > 0) {
        totalPurchases += entry.entryCost;
        totalValue += entry.entryCost;
        totalCostQuantity += entry.entryQuantity;
      }

      // Para salidas (ventas, ajustes, etc.), sumar el costo de salida
      if (entry.exitQuantity > 0) {
        totalSales += entry.exitCost;
      }
    });

    return {
      totalEntries,
      totalExits,
      totalPurchases,
      totalSales, // Ahora correctamente muestra el costo de las salidas
      averageUnitCost:
        totalCostQuantity > 0 ? totalValue / totalCostQuantity : 0,
      totalValue,
    };
  }
}
