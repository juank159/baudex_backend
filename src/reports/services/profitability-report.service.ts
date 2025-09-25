import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';
import { Product } from '../../products/entities/product.entity';
import {
  InventoryMovement,
  MovementType,
} from '../../inventory/entities/inventory-movement.entity';

export interface ProductProfitabilityReport {
  productId: string;
  productName: string;
  productSku: string;
  categoryName?: string;

  // Ventas
  totalSales: number;
  totalQuantitySold: number;
  totalRevenue: number;
  averageSalePrice: number;

  // Costos
  totalCost: number;
  averageCost: number;

  // Rentabilidad
  grossProfit: number;
  profitMargin: number;
  profitPerUnit: number;

  // Análisis adicional
  salesCount: number;
  averageQuantityPerSale: number;
  maxSalePrice: number;
  minSalePrice: number;

  // Período del reporte
  reportPeriodStart: Date;
  reportPeriodEnd: Date;
}

export interface ProfitabilityTrend {
  month: string;
  year: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  quantity: number;
}

export interface CategoryProfitability {
  categoryId: string;
  categoryName: string;
  productsCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    profit: number;
    margin: number;
  }>;
}

@Injectable()
export class ProfitabilityReportService {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
  ) {}

  /**
   * Reporte de rentabilidad por producto
   */
  async getProductProfitabilityReport(
    organizationId: string,
    productId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProductProfitabilityReport[]> {
    const defaultStartDate =
      startDate || new Date(new Date().setMonth(new Date().getMonth() - 12));
    const defaultEndDate = endDate || new Date();

    // Query base para obtener datos de ventas
    const queryBuilder = this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('item.sale', 'sale')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('sale.saleDate BETWEEN :startDate AND :endDate', {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      })
      .andWhere('sale.status IN (:...statuses)', {
        statuses: ['confirmed', 'delivered', 'invoiced'],
      });

    if (productId) {
      queryBuilder.andWhere('item.productId = :productId', { productId });
    }

    const saleItems = await queryBuilder.getMany();

    // Agrupar por producto
    const productGroups = new Map<string, SaleItem[]>();

    saleItems.forEach((item) => {
      const key = item.productId;
      if (!productGroups.has(key)) {
        productGroups.set(key, []);
      }
      productGroups.get(key)!.push(item);
    });

    const reports: ProductProfitabilityReport[] = [];

    for (const [prodId, items] of productGroups) {
      const firstItem = items[0];
      const product = firstItem.product;

      // Calcular métricas
      const totalQuantitySold = items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const totalRevenue = items.reduce(
        (sum, item) => sum + item.finalPrice,
        0,
      );
      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const grossProfit = totalRevenue - totalCost;
      const profitMargin =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      const salePrices = items.map((item) => item.unitPrice);
      const uniqueSales = new Set(items.map((item) => item.saleId)).size;

      reports.push({
        productId: prodId,
        productName: product.name,
        productSku: product.sku,
        categoryName: product.category?.name,

        totalSales: uniqueSales,
        totalQuantitySold,
        totalRevenue,
        averageSalePrice:
          totalQuantitySold > 0 ? totalRevenue / totalQuantitySold : 0,

        totalCost,
        averageCost: totalQuantitySold > 0 ? totalCost / totalQuantitySold : 0,

        grossProfit,
        profitMargin,
        profitPerUnit:
          totalQuantitySold > 0 ? grossProfit / totalQuantitySold : 0,

        salesCount: uniqueSales,
        averageQuantityPerSale:
          uniqueSales > 0 ? totalQuantitySold / uniqueSales : 0,
        maxSalePrice: Math.max(...salePrices, 0),
        minSalePrice: Math.min(...salePrices, 0),

        reportPeriodStart: defaultStartDate,
        reportPeriodEnd: defaultEndDate,
      });
    }

    // Ordenar por rentabilidad descendente
    return reports.sort((a, b) => b.grossProfit - a.grossProfit);
  }

  /**
   * Tendencia de rentabilidad por producto
   */
  async getProductProfitabilityTrend(
    organizationId: string,
    productId: string,
    months: number = 12,
  ): Promise<ProfitabilityTrend[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);

    const saleItems = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.sale', 'sale')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('item.productId = :productId', { productId })
      .andWhere('sale.saleDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('sale.status IN (:...statuses)', {
        statuses: ['confirmed', 'delivered', 'invoiced'],
      })
      .getMany();

    // Agrupar por mes
    const monthlyData = new Map<string, SaleItem[]>();

    saleItems.forEach((item) => {
      const saleDate = new Date(item.sale.saleDate);
      const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, []);
      }
      monthlyData.get(monthKey)!.push(item);
    });

    const trends: ProfitabilityTrend[] = [];

    for (const [monthKey, items] of monthlyData) {
      const [year, month] = monthKey.split('-');
      const revenue = items.reduce((sum, item) => sum + item.finalPrice, 0);
      const cost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const profit = revenue - cost;
      const quantity = items.reduce((sum, item) => sum + item.quantity, 0);

      trends.push({
        month: monthKey,
        year: parseInt(year),
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        quantity,
      });
    }

    return trends.sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Rentabilidad por categoría
   */
  async getCategoryProfitabilityReport(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CategoryProfitability[]> {
    const defaultStartDate =
      startDate || new Date(new Date().setMonth(new Date().getMonth() - 3));
    const defaultEndDate = endDate || new Date();

    const saleItems = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('item.sale', 'sale')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('sale.saleDate BETWEEN :startDate AND :endDate', {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      })
      .andWhere('sale.status IN (:...statuses)', {
        statuses: ['confirmed', 'delivered', 'invoiced'],
      })
      .andWhere('category.id IS NOT NULL')
      .getMany();

    // Agrupar por categoría
    const categoryGroups = new Map<string, SaleItem[]>();

    saleItems.forEach((item) => {
      const categoryId = item.product.category?.id;
      if (categoryId) {
        if (!categoryGroups.has(categoryId)) {
          categoryGroups.set(categoryId, []);
        }
        categoryGroups.get(categoryId)!.push(item);
      }
    });

    const reports: CategoryProfitability[] = [];

    for (const [categoryId, items] of categoryGroups) {
      const category = items[0].product.category;

      const totalRevenue = items.reduce(
        (sum, item) => sum + item.finalPrice,
        0,
      );
      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const totalProfit = totalRevenue - totalCost;

      // Productos únicos en la categoría
      const uniqueProducts = new Map<string, SaleItem[]>();
      items.forEach((item) => {
        const productId = item.productId;
        if (!uniqueProducts.has(productId)) {
          uniqueProducts.set(productId, []);
        }
        uniqueProducts.get(productId)!.push(item);
      });

      // Top productos de la categoría
      const topProducts = Array.from(uniqueProducts.entries())
        .map(([productId, productItems]) => {
          const revenue = productItems.reduce(
            (sum, item) => sum + item.finalPrice,
            0,
          );
          const cost = productItems.reduce(
            (sum, item) => sum + item.totalCost,
            0,
          );
          const profit = revenue - cost;

          return {
            productId,
            productName: productItems[0].product.name,
            profit,
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);

      reports.push({
        categoryId,
        categoryName: category.name,
        productsCount: uniqueProducts.size,
        totalRevenue,
        totalCost,
        totalProfit,
        averageMargin:
          totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        topProducts,
      });
    }

    return reports.sort((a, b) => b.totalProfit - a.totalProfit);
  }

  /**
   * Productos más rentables
   */
  async getTopProfitableProducts(
    organizationId: string,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProductProfitabilityReport[]> {
    const reports = await this.getProductProfitabilityReport(
      organizationId,
      undefined,
      startDate,
      endDate,
    );

    return reports.filter((report) => report.grossProfit > 0).slice(0, limit);
  }

  /**
   * Productos menos rentables
   */
  async getLeastProfitableProducts(
    organizationId: string,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProductProfitabilityReport[]> {
    const reports = await this.getProductProfitabilityReport(
      organizationId,
      undefined,
      startDate,
      endDate,
    );

    return reports
      .sort((a, b) => a.profitMargin - b.profitMargin)
      .slice(0, limit);
  }
}
