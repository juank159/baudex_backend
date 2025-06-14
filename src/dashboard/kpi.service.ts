// src/modules/dashboard/services/kpi.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Product } from 'src/products/entities/product.entity';
import { Repository } from 'typeorm';
import { KpiQueryDto } from './dto/kpi-query.dto';
import { FinancialKPIs } from './interfaces/dashboard.interfaces';

@Injectable()
export class KpiService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getFinancialKPIs(query: KpiQueryDto): Promise<FinancialKPIs> {
    const { startDate, endDate } = this.getDateRange(
      query.startDate,
      query.endDate,
    );
    const previousPeriod = this.getPreviousPeriod(startDate, endDate);

    const [salesKPIs, expenseKPIs, customerKPIs, inventoryKPIs, cashFlowKPIs] =
      await Promise.all([
        this.getSalesKPIs(startDate, endDate),
        this.getExpenseKPIs(startDate, endDate),
        this.getCustomerKPIs(startDate, endDate),
        this.getInventoryKPIs(),
        this.getCashFlowKPIs(startDate, endDate),
      ]);

    // Calcular rentabilidad
    const grossProfit = salesKPIs.totalRevenue - expenseKPIs.totalExpenses;
    const grossProfitMargin =
      salesKPIs.totalRevenue > 0
        ? (grossProfit / salesKPIs.totalRevenue) * 100
        : 0;

    // Para el net profit, asumimos que los gastos incluyen todos los costos
    const netProfit = grossProfit;
    const netProfitMargin =
      salesKPIs.totalRevenue > 0
        ? (netProfit / salesKPIs.totalRevenue) * 100
        : 0;

    const result: FinancialKPIs = {
      // Ventas
      totalRevenue: salesKPIs.totalRevenue,
      averageOrderValue: salesKPIs.averageOrderValue,
      conversionRate: salesKPIs.conversionRate,

      // Gastos
      totalExpenses: expenseKPIs.totalExpenses,
      expenseRatio:
        salesKPIs.totalRevenue > 0
          ? (expenseKPIs.totalExpenses / salesKPIs.totalRevenue) * 100
          : 0,

      // Rentabilidad
      grossProfit,
      grossProfitMargin,
      netProfit,
      netProfitMargin,

      // Clientes
      customerAcquisitionCost: customerKPIs.customerAcquisitionCost,
      customerLifetimeValue: customerKPIs.customerLifetimeValue,
      customerRetentionRate: customerKPIs.customerRetentionRate,

      // Inventario
      inventoryTurnover: inventoryKPIs.inventoryTurnover,
      daysInInventory: inventoryKPIs.daysInInventory,

      // Liquidez
      accountsReceivable: cashFlowKPIs.accountsReceivable,
      averageCollectionPeriod: cashFlowKPIs.averageCollectionPeriod,
    };

    // Si se solicita comparación con período anterior
    if (query.compareWithPrevious) {
      const previousKPIs = await this.getFinancialKPIs({
        ...query,
        startDate: previousPeriod.startDate.toISOString(),
        endDate: previousPeriod.endDate.toISOString(),
        compareWithPrevious: false,
      });

      // Agregar comparaciones como propiedades adicionales
      (result as any).comparison = this.calculateComparisons(
        result,
        previousKPIs,
      );
    }

    return result;
  }

  async getSalesMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSales: number;
    salesGrowth: number;
    averageOrderValue: number;
    salesByChannel: any[];
    topSellingProducts: any[];
  }> {
    // Ventas totales
    const salesResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'SUM(invoice.total) as total_sales',
        'COUNT(invoice.id) as total_orders',
        'AVG(invoice.total) as average_order_value',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .getRawOne();

    // Crecimiento comparado con período anterior
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStart = new Date(startDate.getTime() - periodLength);
    const previousEnd = new Date(endDate.getTime() - periodLength);

    const previousSalesResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total)', 'previous_sales')
      .where('invoice.date >= :startDate', { startDate: previousStart })
      .andWhere('invoice.date <= :endDate', { endDate: previousEnd })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .getRawOne();

    const currentSales = parseFloat(salesResult.total_sales) || 0;
    const previousSales = parseFloat(previousSalesResult.previous_sales) || 0;
    const salesGrowth =
      previousSales > 0
        ? ((currentSales - previousSales) / previousSales) * 100
        : 0;

    // Ventas por método de pago (canal)
    const salesByChannel = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'invoice.paymentMethod as channel',
        'SUM(invoice.total) as total',
        'COUNT(invoice.id) as count',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy('invoice.paymentMethod')
      .orderBy('total', 'DESC')
      .getRawMany();

    // Top productos más vendidos
    const topSellingProducts = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'items')
      .leftJoin('items.product', 'product')
      .select([
        'product.name as product_name',
        'SUM(items.quantity) as quantity_sold',
        'SUM(items.subtotal) as revenue',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .andWhere('product.id IS NOT NULL')
      .groupBy('product.id, product.name')
      .orderBy('revenue', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalSales: currentSales,
      salesGrowth,
      averageOrderValue: parseFloat(salesResult.average_order_value) || 0,
      salesByChannel: salesByChannel.map((item) => ({
        channel: item.channel,
        total: parseFloat(item.total),
        count: parseInt(item.count),
      })),
      topSellingProducts: topSellingProducts.map((item) => ({
        productName: item.product_name,
        quantitySold: parseFloat(item.quantity_sold),
        revenue: parseFloat(item.revenue),
      })),
    };
  }

  async getExpenseMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalExpenses: number;
    expenseGrowth: number;
    expensesByCategory: any[];
    averageExpensePerDay: number;
    expensesVsBudget: any[];
  }> {
    // Gastos totales
    const expensesResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'total_expenses')
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .getRawOne();

    const totalExpenses = parseFloat(expensesResult.total_expenses) || 0;
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const averageExpensePerDay = daysDiff > 0 ? totalExpenses / daysDiff : 0;

    // Gastos por categoría
    const expensesByCategory = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select([
        'category.name as category_name',
        'SUM(expense.amount) as total_amount',
        'COUNT(expense.id) as count',
      ])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .groupBy('category.id, category.name')
      .orderBy('total_amount', 'DESC')
      .getRawMany();

    // Comparación con presupuesto
    const expensesVsBudget = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select([
        'category.name as category_name',
        'category.monthlyBudget as budget',
        'SUM(expense.amount) as spent',
      ])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .andWhere('category.monthlyBudget > 0')
      .groupBy('category.id, category.name, category.monthlyBudget')
      .getRawMany();

    return {
      totalExpenses,
      expenseGrowth: 0, // Se calculará comparando con período anterior
      averageExpensePerDay,
      expensesByCategory: expensesByCategory.map((item) => ({
        categoryName: item.category_name,
        totalAmount: parseFloat(item.total_amount),
        count: parseInt(item.count),
      })),
      expensesVsBudget: expensesVsBudget.map((item) => ({
        categoryName: item.category_name,
        budget: parseFloat(item.budget),
        spent: parseFloat(item.spent),
        percentage:
          parseFloat(item.budget) > 0
            ? (parseFloat(item.spent) / parseFloat(item.budget)) * 100
            : 0,
      })),
    };
  }

  async getCustomerMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalCustomers: number;
    newCustomers: number;
    activeCustomers: number;
    customerRetentionRate: number;
    averageCustomerValue: number;
    customersAtRisk: number;
  }> {
    const totalCustomers = await this.customerRepository.count();

    // Nuevos clientes en el período - corregido
    const newCustomers = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.createdAt >= :startDate', { startDate })
      .andWhere('customer.createdAt <= :endDate', { endDate })
      .getCount();

    // Clientes activos (con al menos una compra en el período)
    const activeCustomersResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(DISTINCT invoice.customerId)', 'active_customers')
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .getRawOne();

    // Valor promedio por cliente
    const customerValueResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('AVG(customer_total.total)', 'average_value')
      .from((subQuery) => {
        return subQuery
          .select(['invoice.customerId', 'SUM(invoice.total) as total'])
          .from('invoices', 'invoice')
          .where('invoice.date >= :startDate', { startDate })
          .andWhere('invoice.date <= :endDate', { endDate })
          .andWhere('invoice.status IN (:...statuses)', {
            statuses: ['paid', 'partially_paid'],
          })
          .groupBy('invoice.customerId');
      }, 'customer_total')
      .getRawOne();

    // Clientes en riesgo (con facturas vencidas)
    const customersAtRiskResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(DISTINCT invoice.customerId)', 'at_risk_customers')
      .where('invoice.dueDate < :today', { today: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['pending', 'partially_paid'],
      })
      .getRawOne();

    return {
      totalCustomers,
      newCustomers,
      activeCustomers: parseInt(activeCustomersResult.active_customers) || 0,
      customerRetentionRate: 0, // Se calculará con lógica más compleja
      averageCustomerValue: parseFloat(customerValueResult.average_value) || 0,
      customersAtRisk: parseInt(customersAtRiskResult.at_risk_customers) || 0,
    };
  }

  async getInventoryMetrics(): Promise<{
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    inventoryValue: number;
    fastMovingProducts: any[];
    slowMovingProducts: any[];
  }> {
    const totalProducts = await this.productRepository.count();

    const lowStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock <= product.minStock')
      .andWhere('product.status = :status', { status: 'active' })
      .getCount();

    // Usar stock = 0 para productos sin stock (más confiable que status)
    const outOfStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock = 0')
      .getCount();

    // Valor del inventario usando precio del producto directamente
    const inventoryValueResult = await this.productRepository
      .createQueryBuilder('product')
      .select(
        'SUM(product.stock * COALESCE(product.price, 0))',
        'inventory_value',
      )
      .where('product.status = :status', { status: 'active' })
      .andWhere('product.stock > 0')
      .getRawOne();

    return {
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      inventoryValue: parseFloat(inventoryValueResult.inventory_value) || 0,
      fastMovingProducts: [], // Se implementará con lógica de rotación
      slowMovingProducts: [], // Se implementará con lógica de rotación
    };
  }

  // Métodos auxiliares privados
  private async getSalesKPIs(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRevenue: number;
    averageOrderValue: number;
    conversionRate: number;
  }> {
    const salesResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'SUM(invoice.total) as total_revenue',
        'AVG(invoice.total) as average_order_value',
        'COUNT(invoice.id) as total_orders',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .getRawOne();

    return {
      totalRevenue: parseFloat(salesResult.total_revenue) || 0,
      averageOrderValue: parseFloat(salesResult.average_order_value) || 0,
      conversionRate: 100, // Placeholder - se calculará con datos de visitantes/leads
    };
  }

  private async getExpenseKPIs(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalExpenses: number;
  }> {
    const expenseResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'total_expenses')
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .getRawOne();

    return {
      totalExpenses: parseFloat(expenseResult.total_expenses) || 0,
    };
  }

  private async getCustomerKPIs(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    customerAcquisitionCost: number;
    customerLifetimeValue: number;
    customerRetentionRate: number;
  }> {
    // Costo de adquisición de clientes (CAC)
    const marketingExpenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'marketing_expenses')
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.type = :type', { type: 'sales' })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .getRawOne();

    // Nuevos clientes - corregido
    const newCustomers = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.createdAt >= :startDate', { startDate })
      .andWhere('customer.createdAt <= :endDate', { endDate })
      .getCount();

    const customerAcquisitionCost =
      newCustomers > 0
        ? (parseFloat(marketingExpenses.marketing_expenses) || 0) / newCustomers
        : 0;

    // Valor de vida del cliente (CLV) - simplificado
    const avgCustomerValue = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('AVG(customer_totals.total)', 'avg_value')
      .from((subQuery) => {
        return subQuery
          .select(['invoice.customerId', 'SUM(invoice.total) as total'])
          .from('invoices', 'invoice')
          .where('invoice.status IN (:...statuses)', {
            statuses: ['paid', 'partially_paid'],
          })
          .groupBy('invoice.customerId');
      }, 'customer_totals')
      .getRawOne();

    return {
      customerAcquisitionCost,
      customerLifetimeValue: parseFloat(avgCustomerValue.avg_value) || 0,
      customerRetentionRate: 85, // Placeholder - se calculará con lógica más compleja
    };
  }

  private async getInventoryKPIs(): Promise<{
    inventoryTurnover: number;
    daysInInventory: number;
  }> {
    // Rotación de inventario - simplificado
    return {
      inventoryTurnover: 4, // Placeholder
      daysInInventory: 90, // Placeholder
    };
  }

  private async getCashFlowKPIs(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    accountsReceivable: number;
    averageCollectionPeriod: number;
  }> {
    const accountsReceivableResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.balanceDue)', 'accounts_receivable')
      .where('invoice.status IN (:...statuses)', {
        statuses: ['pending', 'partially_paid'],
      })
      .getRawOne();

    return {
      accountsReceivable:
        parseFloat(accountsReceivableResult.accounts_receivable) || 0,
      averageCollectionPeriod: 30, // Placeholder
    };
  }

  private getDateRange(
    startDate?: string,
    endDate?: string,
  ): { startDate: Date; endDate: Date } {
    if (startDate && endDate) {
      return {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
    }

    // Por defecto, último mes
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth(), 0),
    };
  }

  private getPreviousPeriod(
    startDate: Date,
    endDate: Date,
  ): { startDate: Date; endDate: Date } {
    const periodLength = endDate.getTime() - startDate.getTime();
    return {
      startDate: new Date(startDate.getTime() - periodLength),
      endDate: new Date(endDate.getTime() - periodLength),
    };
  }

  private calculateComparisons(
    current: FinancialKPIs,
    previous: FinancialKPIs,
  ): any {
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      totalRevenue: calculateChange(
        current.totalRevenue,
        previous.totalRevenue,
      ),
      totalExpenses: calculateChange(
        current.totalExpenses,
        previous.totalExpenses,
      ),
      netProfit: calculateChange(current.netProfit, previous.netProfit),
      netProfitMargin: current.netProfitMargin - previous.netProfitMargin,
      // Agregar más comparaciones según sea necesario
    };
  }
}
