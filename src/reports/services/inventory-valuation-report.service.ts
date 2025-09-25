import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InventoryBatch,
  BatchStatus,
} from '../../inventory/entities/inventory-batch.entity';
import { Product } from '../../products/entities/product.entity';
import { Category } from '../../categories/entities/category.entity';

export interface InventoryValuationSummary {
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  averageCostPerUnit: number;
  totalBatches: number;
  activeBatches: number;

  // Análisis por antigüedad
  byAge: {
    lessThan30Days: { quantity: number; value: number; percentage: number };
    days30To90: { quantity: number; value: number; percentage: number };
    days90To180: { quantity: number; value: number; percentage: number };
    moreThan180Days: { quantity: number; value: number; percentage: number };
  };

  reportDate: Date;
}

export interface ProductValuationDetail {
  productId: string;
  productName: string;
  productSku: string;
  categoryName?: string;

  totalQuantity: number;
  totalValue: number;
  averageCost: number;
  batchesCount: number;

  // Lote más antiguo y más nuevo
  oldestBatch: {
    batchNumber: string;
    purchaseDate: Date;
    daysOld: number;
    quantity: number;
    value: number;
  } | null;

  newestBatch: {
    batchNumber: string;
    purchaseDate: Date;
    daysOld: number;
    quantity: number;
    value: number;
  } | null;

  // Distribución por antigüedad
  ageDistribution: {
    lessThan30Days: number;
    days30To90: number;
    days90To180: number;
    moreThan180Days: number;
  };

  batches: Array<{
    batchId: string;
    batchNumber: string;
    purchaseDate: Date;
    quantity: number;
    unitCost: number;
    totalValue: number;
    daysInInventory: number;
    supplierLotNumber?: string;
  }>;
}

export interface CategoryValuationSummary {
  categoryId: string;
  categoryName: string;
  productsCount: number;
  totalQuantity: number;
  totalValue: number;
  averageCost: number;
  percentageOfTotalValue: number;

  topProducts: Array<{
    productId: string;
    productName: string;
    value: number;
    percentage: number;
  }>;
}

export interface InventoryAgingReport {
  summary: {
    totalValue: number;
    averageAge: number;
    oldestItemDays: number;
  };

  ageRanges: Array<{
    range: string;
    minDays: number;
    maxDays: number | null;
    itemsCount: number;
    totalQuantity: number;
    totalValue: number;
    percentage: number;
    averageCost: number;
  }>;

  slowMovingItems: Array<{
    productId: string;
    productName: string;
    batchNumber: string;
    daysInInventory: number;
    quantity: number;
    value: number;
    unitCost: number;
  }>;
}

@Injectable()
export class InventoryValuationReportService {
  constructor(
    @InjectRepository(InventoryBatch)
    private batchRepository: Repository<InventoryBatch>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  /**
   * Reporte de valoración general del inventario
   */
  async getInventoryValuationSummary(
    organizationId: string,
  ): Promise<InventoryValuationSummary> {
    const activeBatches = await this.batchRepository.find({
      where: {
        organizationId,
        status: BatchStatus.ACTIVE,
      },
      relations: ['product'],
    });

    const totalBatches = await this.batchRepository.count({
      where: { organizationId },
    });

    const now = new Date();
    const totalQuantity = activeBatches.reduce(
      (sum, batch) => sum + batch.currentQuantity,
      0,
    );
    const totalValue = activeBatches.reduce(
      (sum, batch) => sum + batch.remainingValue,
      0,
    );
    const uniqueProducts = new Set(
      activeBatches.map((batch) => batch.productId),
    ).size;

    // Análisis por antigüedad
    const agingAnalysis = {
      lessThan30Days: { quantity: 0, value: 0, percentage: 0 },
      days30To90: { quantity: 0, value: 0, percentage: 0 },
      days90To180: { quantity: 0, value: 0, percentage: 0 },
      moreThan180Days: { quantity: 0, value: 0, percentage: 0 },
    };

    activeBatches.forEach((batch) => {
      const daysOld = Math.floor(
        (now.getTime() - batch.purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const quantity = batch.currentQuantity;
      const value = batch.remainingValue;

      if (daysOld < 30) {
        agingAnalysis.lessThan30Days.quantity += quantity;
        agingAnalysis.lessThan30Days.value += value;
      } else if (daysOld < 90) {
        agingAnalysis.days30To90.quantity += quantity;
        agingAnalysis.days30To90.value += value;
      } else if (daysOld < 180) {
        agingAnalysis.days90To180.quantity += quantity;
        agingAnalysis.days90To180.value += value;
      } else {
        agingAnalysis.moreThan180Days.quantity += quantity;
        agingAnalysis.moreThan180Days.value += value;
      }
    });

    // Calcular porcentajes
    Object.keys(agingAnalysis).forEach((key) => {
      agingAnalysis[key].percentage =
        totalValue > 0 ? (agingAnalysis[key].value / totalValue) * 100 : 0;
    });

    return {
      totalProducts: uniqueProducts,
      totalQuantity,
      totalValue,
      averageCostPerUnit: totalQuantity > 0 ? totalValue / totalQuantity : 0,
      totalBatches,
      activeBatches: activeBatches.length,
      byAge: agingAnalysis,
      reportDate: now,
    };
  }

  /**
   * Detalle de valoración por producto
   */
  async getProductValuationDetails(
    organizationId: string,
    productId?: string,
  ): Promise<ProductValuationDetail[]> {
    const queryBuilder = this.batchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .where('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .andWhere('batch.currentQuantity > 0');

    if (productId) {
      queryBuilder.andWhere('batch.productId = :productId', { productId });
    }

    const batches = await queryBuilder
      .orderBy('product.name', 'ASC')
      .addOrderBy('batch.purchaseDate', 'ASC')
      .getMany();

    // Agrupar por producto
    const productGroups = new Map<string, InventoryBatch[]>();

    batches.forEach((batch) => {
      const productId = batch.productId;
      if (!productGroups.has(productId)) {
        productGroups.set(productId, []);
      }
      productGroups.get(productId)!.push(batch);
    });

    const details: ProductValuationDetail[] = [];
    const now = new Date();

    for (const [prodId, productBatches] of productGroups) {
      const product = productBatches[0].product;

      const totalQuantity = productBatches.reduce(
        (sum, batch) => sum + batch.currentQuantity,
        0,
      );
      const totalValue = productBatches.reduce(
        (sum, batch) => sum + batch.remainingValue,
        0,
      );

      // Lote más antiguo y más nuevo
      const sortedByDate = [...productBatches].sort(
        (a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime(),
      );

      const oldestBatch = sortedByDate[0];
      const newestBatch = sortedByDate[sortedByDate.length - 1];

      // Distribución por antigüedad
      const ageDistribution = {
        lessThan30Days: 0,
        days30To90: 0,
        days90To180: 0,
        moreThan180Days: 0,
      };

      productBatches.forEach((batch) => {
        const daysOld = Math.floor(
          (now.getTime() - batch.purchaseDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysOld < 30) {
          ageDistribution.lessThan30Days += batch.currentQuantity;
        } else if (daysOld < 90) {
          ageDistribution.days30To90 += batch.currentQuantity;
        } else if (daysOld < 180) {
          ageDistribution.days90To180 += batch.currentQuantity;
        } else {
          ageDistribution.moreThan180Days += batch.currentQuantity;
        }
      });

      details.push({
        productId: prodId,
        productName: product.name,
        productSku: product.sku,
        categoryName: product.category?.name,

        totalQuantity,
        totalValue,
        averageCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
        batchesCount: productBatches.length,

        oldestBatch: {
          batchNumber: oldestBatch.batchNumber,
          purchaseDate: oldestBatch.purchaseDate,
          daysOld: Math.floor(
            (now.getTime() - oldestBatch.purchaseDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
          quantity: oldestBatch.currentQuantity,
          value: oldestBatch.remainingValue,
        },

        newestBatch: {
          batchNumber: newestBatch.batchNumber,
          purchaseDate: newestBatch.purchaseDate,
          daysOld: Math.floor(
            (now.getTime() - newestBatch.purchaseDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
          quantity: newestBatch.currentQuantity,
          value: newestBatch.remainingValue,
        },

        ageDistribution,

        batches: productBatches.map((batch) => ({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          purchaseDate: batch.purchaseDate,
          quantity: batch.currentQuantity,
          unitCost: batch.unitCost,
          totalValue: batch.remainingValue,
          daysInInventory: Math.floor(
            (now.getTime() - batch.purchaseDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
          supplierLotNumber: batch.supplierLotNumber,
        })),
      });
    }

    return details.sort((a, b) => b.totalValue - a.totalValue);
  }

  /**
   * Valoración por categorías
   */
  async getCategoryValuationSummary(
    organizationId: string,
  ): Promise<CategoryValuationSummary[]> {
    const batches = await this.batchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .where('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
      .andWhere('batch.currentQuantity > 0')
      .andWhere('category.id IS NOT NULL')
      .getMany();

    const totalInventoryValue = batches.reduce(
      (sum, batch) => sum + batch.remainingValue,
      0,
    );

    // Agrupar por categoría
    const categoryGroups = new Map<string, InventoryBatch[]>();

    batches.forEach((batch) => {
      const categoryId = batch.product.category?.id;
      if (categoryId) {
        if (!categoryGroups.has(categoryId)) {
          categoryGroups.set(categoryId, []);
        }
        categoryGroups.get(categoryId)!.push(batch);
      }
    });

    const summaries: CategoryValuationSummary[] = [];

    for (const [categoryId, categoryBatches] of categoryGroups) {
      const category = categoryBatches[0].product.category;

      const totalQuantity = categoryBatches.reduce(
        (sum, batch) => sum + batch.currentQuantity,
        0,
      );
      const totalValue = categoryBatches.reduce(
        (sum, batch) => sum + batch.remainingValue,
        0,
      );

      // Productos únicos en la categoría
      const uniqueProducts = new Map<string, InventoryBatch[]>();
      categoryBatches.forEach((batch) => {
        const productId = batch.productId;
        if (!uniqueProducts.has(productId)) {
          uniqueProducts.set(productId, []);
        }
        uniqueProducts.get(productId)!.push(batch);
      });

      // Top productos por valor
      const topProducts = Array.from(uniqueProducts.entries())
        .map(([productId, productBatches]) => {
          const value = productBatches.reduce(
            (sum, batch) => sum + batch.remainingValue,
            0,
          );
          return {
            productId,
            productName: productBatches[0].product.name,
            value,
            percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      summaries.push({
        categoryId,
        categoryName: category.name,
        productsCount: uniqueProducts.size,
        totalQuantity,
        totalValue,
        averageCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
        percentageOfTotalValue:
          totalInventoryValue > 0
            ? (totalValue / totalInventoryValue) * 100
            : 0,
        topProducts,
      });
    }

    return summaries.sort((a, b) => b.totalValue - a.totalValue);
  }

  /**
   * Reporte de antigüedad del inventario
   */
  async getInventoryAgingReport(
    organizationId: string,
  ): Promise<InventoryAgingReport> {
    const batches = await this.batchRepository.find({
      where: {
        organizationId,
        status: BatchStatus.ACTIVE,
      },
      relations: ['product'],
      order: {
        purchaseDate: 'ASC',
      },
    });

    const now = new Date();
    const totalValue = batches.reduce(
      (sum, batch) => sum + batch.remainingValue,
      0,
    );

    // Calcular edad promedio ponderada por valor
    let weightedAgeSum = 0;
    let oldestItemDays = 0;

    batches.forEach((batch) => {
      const daysOld = Math.floor(
        (now.getTime() - batch.purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      weightedAgeSum += daysOld * batch.remainingValue;
      oldestItemDays = Math.max(oldestItemDays, daysOld);
    });

    const averageAge = totalValue > 0 ? weightedAgeSum / totalValue : 0;

    // Definir rangos de antigüedad
    const ageRanges = [
      { range: '0-30 días', minDays: 0, maxDays: 30 },
      { range: '31-60 días', minDays: 31, maxDays: 60 },
      { range: '61-90 días', minDays: 61, maxDays: 90 },
      { range: '91-180 días', minDays: 91, maxDays: 180 },
      { range: '181-365 días', minDays: 181, maxDays: 365 },
      { range: 'Más de 365 días', minDays: 366, maxDays: null },
    ];

    const rangeAnalysis = ageRanges.map((range) => {
      const batchesInRange = batches.filter((batch) => {
        const daysOld = Math.floor(
          (now.getTime() - batch.purchaseDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return (
          daysOld >= range.minDays &&
          (range.maxDays === null || daysOld <= range.maxDays)
        );
      });

      const totalQuantity = batchesInRange.reduce(
        (sum, batch) => sum + batch.currentQuantity,
        0,
      );
      const totalValue = batchesInRange.reduce(
        (sum, batch) => sum + batch.remainingValue,
        0,
      );

      return {
        ...range,
        itemsCount: batchesInRange.length,
        totalQuantity,
        totalValue,
        percentage: totalValue > 0 ? (totalValue / totalValue) * 100 : 0,
        averageCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
      };
    });

    // Productos de movimiento lento (más de 180 días)
    const slowMovingItems = batches
      .filter((batch) => {
        const daysOld = Math.floor(
          (now.getTime() - batch.purchaseDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return daysOld > 180;
      })
      .map((batch) => ({
        productId: batch.productId,
        productName: batch.product.name,
        batchNumber: batch.batchNumber,
        daysInInventory: Math.floor(
          (now.getTime() - batch.purchaseDate.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
        quantity: batch.currentQuantity,
        value: batch.remainingValue,
        unitCost: batch.unitCost,
      }))
      .sort((a, b) => b.daysInInventory - a.daysInInventory);

    return {
      summary: {
        totalValue,
        averageAge,
        oldestItemDays,
      },
      ageRanges: rangeAnalysis,
      slowMovingItems,
    };
  }
}
