// src/modules/dashboard/services/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Product } from 'src/products/entities/product.entity';
import { InvoicesService } from 'src/invoices/invoices.service';
import { CustomersService } from 'src/customers/customers.service';
import { ExpensesService } from 'src/expenses/expenses.service';
import { ProductService } from 'src/products/products.service';
import { DashboardPeriod, DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  CashFlowData,
  CategorySales,
  DashboardSummary,
  ExpensesBreakdown,
  PaymentMethodStats,
  SalesChart,
  TopCustomers,
  TopProducts,
} from './interfaces/dashboard.interfaces';
import { ChartQueryDto } from './dto/chart-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly invoicesService: InvoicesService,
    private readonly expensesService: ExpensesService,
    private readonly customersService: CustomersService,
    private readonly productsService: ProductService,
  ) {}

  async getDashboardSummary(
    query: DashboardQueryDto,
  ): Promise<DashboardSummary> {
    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    // Consultas en paralelo para mejor rendimiento
    const [salesData, expensesData, invoiceStats, customerStats, productStats] =
      await Promise.all([
        this.getSalesData(startDate, endDate),
        this.getExpensesData(startDate, endDate),
        this.getInvoiceStats(startDate, endDate),
        this.getCustomerStats(startDate, endDate),
        this.getProductStats(),
      ]);

    const netProfit = salesData.totalSales - expensesData.totalExpenses;
    const profitMargin =
      salesData.totalSales > 0 ? (netProfit / salesData.totalSales) * 100 : 0;

    return {
      totalSales: salesData.totalSales,
      totalExpenses: expensesData.totalExpenses,
      netProfit,
      profitMargin,
      totalInvoices: invoiceStats.total,
      paidInvoices: invoiceStats.paid,
      pendingInvoices: invoiceStats.pending,
      overdueInvoices: invoiceStats.overdue,
      totalCustomers: customerStats.total,
      activeCustomers: customerStats.active,
      newCustomersThisMonth: customerStats.newThisMonth,
      totalProducts: productStats.total,
      lowStockProducts: productStats.lowStock,
      outOfStockProducts: productStats.outOfStock,
      period: {
        startDate,
        endDate,
        type: query.period || DashboardPeriod.THIS_MONTH,
      },
    };
  }

  async getSalesChart(query: ChartQueryDto): Promise<SalesChart[]> {
    const { startDate, endDate } = this.getDateRange(
      undefined,
      query.startDate,
      query.endDate,
    );

    const dateFormat = this.getDateFormat(query.chartPeriod);

    // Ventas por período
    const salesData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        `DATE_TRUNC('${query.chartPeriod}', invoice.date) as date`,
        'SUM(invoice.total) as sales',
        'COUNT(invoice.id) as invoice_count',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy(`DATE_TRUNC('${query.chartPeriod}', invoice.date)`)
      .orderBy('date', 'ASC')
      .getRawMany();

    // Gastos por período
    const expensesData = await this.expenseRepository
      .createQueryBuilder('expense')
      .select([
        `DATE_TRUNC('${query.chartPeriod}', expense.date) as date`,
        'SUM(expense.amount) as expenses',
      ])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .groupBy(`DATE_TRUNC('${query.chartPeriod}', expense.date)`)
      .orderBy('date', 'ASC')
      .getRawMany();

    // Combinar datos
    const salesMap = new Map(
      salesData.map((item) => [
        item.date.toISOString().split('T')[0],
        {
          sales: parseFloat(item.sales),
          invoiceCount: parseInt(item.invoice_count),
        },
      ]),
    );

    const expensesMap = new Map(
      expensesData.map((item) => [
        item.date.toISOString().split('T')[0],
        parseFloat(item.expenses),
      ]),
    );

    // Generar serie completa de fechas
    const result: SalesChart[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const sales = salesMap.get(dateKey)?.sales || 0;
      const expenses = expensesMap.get(dateKey) || 0;
      const invoiceCount = salesMap.get(dateKey)?.invoiceCount || 0;

      result.push({
        date: dateKey,
        sales,
        expenses,
        profit: sales - expenses,
        invoiceCount,
      });

      // Incrementar fecha según el período
      if (query.chartPeriod === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (query.chartPeriod === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (query.chartPeriod === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    return result;
  }

  async getTopProducts(query: DashboardQueryDto): Promise<TopProducts[]> {
    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    const topProducts = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'items')
      .leftJoin('items.product', 'product')
      .select([
        'product.id as product_id',
        'product.name as product_name',
        'product.sku as sku',
        'SUM(items.quantity) as quantity_sold',
        'SUM(items.subtotal) as total_revenue',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .andWhere('product.id IS NOT NULL')
      .groupBy('product.id, product.name, product.sku')
      .orderBy('total_revenue', 'DESC')
      .limit(query.limit || 10)
      .getRawMany();

    return topProducts.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      sku: item.sku,
      quantitySold: parseFloat(item.quantity_sold),
      totalRevenue: parseFloat(item.total_revenue),
      profitMargin: 0, // Se calculará con costos de productos
    }));
  }

  async getTopCustomers(query: DashboardQueryDto): Promise<TopCustomers[]> {
    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    const topCustomers = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.customer', 'customer')
      .select([
        'customer.id as customer_id',
        'customer.firstName as first_name',
        'customer.lastName as last_name',
        'customer.companyName as company_name',
        'SUM(invoice.total) as total_purchases',
        'COUNT(invoice.id) as invoice_count',
        'MAX(invoice.date) as last_purchase',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy(
        'customer.id, customer.firstName, customer.lastName, customer.companyName',
      )
      .orderBy('total_purchases', 'DESC')
      .limit(query.limit || 10)
      .getRawMany();

    return topCustomers.map((item) => ({
      customerId: item.customer_id,
      customerName: `${item.first_name} ${item.last_name}`,
      companyName: item.company_name,
      totalPurchases: parseFloat(item.total_purchases),
      invoiceCount: parseInt(item.invoice_count),
      lastPurchase: new Date(item.last_purchase),
      riskLevel: 'low' as const, // Se calculará con lógica de riesgo
    }));
  }

  async getCategorySales(query: DashboardQueryDto): Promise<CategorySales[]> {
    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    const categorySales = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'items')
      .leftJoin('items.product', 'product')
      .leftJoin('product.category', 'category')
      .select([
        'category.id as category_id',
        'category.name as category_name',
        'SUM(items.subtotal) as total_sales',
        'COUNT(DISTINCT product.id) as product_count',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .andWhere('category.id IS NOT NULL')
      .groupBy('category.id, category.name')
      .orderBy('total_sales', 'DESC')
      .getRawMany();

    const totalSales = categorySales.reduce(
      (sum, item) => sum + parseFloat(item.total_sales),
      0,
    );

    return categorySales.map((item) => ({
      categoryId: item.category_id,
      categoryName: item.category_name,
      totalSales: parseFloat(item.total_sales),
      productCount: parseInt(item.product_count),
      percentage:
        totalSales > 0 ? (parseFloat(item.total_sales) / totalSales) * 100 : 0,
    }));
  }

  async getExpensesBreakdown(
    query: DashboardQueryDto,
  ): Promise<ExpensesBreakdown[]> {
    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    const expensesData = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select([
        'category.id as category_id',
        'category.name as category_name',
        'category.monthlyBudget as monthly_budget',
        'category.color as color',
        'SUM(expense.amount) as total_amount',
      ])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .groupBy(
        'category.id, category.name, category.monthlyBudget, category.color',
      )
      .orderBy('total_amount', 'DESC')
      .getRawMany();

    const totalExpenses = expensesData.reduce(
      (sum, item) => sum + parseFloat(item.total_amount),
      0,
    );

    return expensesData.map((item) => ({
      categoryId: item.category_id,
      categoryName: item.category_name,
      totalAmount: parseFloat(item.total_amount),
      percentage:
        totalExpenses > 0
          ? (parseFloat(item.total_amount) / totalExpenses) * 100
          : 0,
      budgetUsed:
        item.monthly_budget > 0
          ? (parseFloat(item.total_amount) / parseFloat(item.monthly_budget)) *
            100
          : 0,
      color: item.color,
    }));
  }

  async getCashFlow(query: DashboardQueryDto): Promise<CashFlowData[]> {
    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    // Ingresos diarios
    const incomeData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'DATE(invoice.date) as date',
        'SUM(invoice.paidAmount) as income',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.paidAmount > 0')
      .groupBy('DATE(invoice.date)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Gastos diarios
    const expenseData = await this.expenseRepository
      .createQueryBuilder('expense')
      .select(['DATE(expense.date) as date', 'SUM(expense.amount) as expenses'])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status = :status', { status: 'paid' })
      .groupBy('DATE(expense.date)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Combinar datos
    const incomeMap = new Map(
      incomeData.map((item) => [item.date, parseFloat(item.income)]),
    );
    const expenseMap = new Map(
      expenseData.map((item) => [item.date, parseFloat(item.expenses)]),
    );

    const result: CashFlowData[] = [];
    let cumulativeFlow = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const income = incomeMap.get(dateKey) || 0;
      const expenses = expenseMap.get(dateKey) || 0;
      const netFlow = income - expenses;
      cumulativeFlow += netFlow;

      result.push({
        date: dateKey,
        income,
        expenses,
        netFlow,
        cumulativeFlow,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  async getPaymentMethodStats(
    query: DashboardQueryDto,
  ): Promise<PaymentMethodStats[]> {
    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    const paymentStats = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'invoice.paymentMethod as method',
        'COUNT(invoice.id) as count',
        'SUM(invoice.total) as total_amount',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy('invoice.paymentMethod')
      .orderBy('total_amount', 'DESC')
      .getRawMany();

    const totalAmount = paymentStats.reduce(
      (sum, item) => sum + parseFloat(item.total_amount),
      0,
    );

    return paymentStats.map((item) => ({
      method: item.method,
      count: parseInt(item.count),
      totalAmount: parseFloat(item.total_amount),
      percentage:
        totalAmount > 0
          ? (parseFloat(item.total_amount) / totalAmount) * 100
          : 0,
    }));
  }

  // Métodos auxiliares privados
  private getDateRange(
    period?: DashboardPeriod,
    startDate?: string,
    endDate?: string,
  ): { startDate: Date; endDate: Date } {
    if (period === DashboardPeriod.CUSTOM && startDate && endDate) {
      return {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
    }

    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    switch (period) {
      case DashboardPeriod.TODAY:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case DashboardPeriod.YESTERDAY:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case DashboardPeriod.LAST_7_DAYS:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case DashboardPeriod.LAST_30_DAYS:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case DashboardPeriod.THIS_MONTH:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case DashboardPeriod.LAST_MONTH:
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case DashboardPeriod.THIS_QUARTER:
        const currentQuarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQuarter * 3, 1);
        break;
      case DashboardPeriod.LAST_QUARTER:
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        start = new Date(now.getFullYear(), lastQuarter * 3, 1);
        end = new Date(now.getFullYear(), (lastQuarter + 1) * 3, 0);
        break;
      case DashboardPeriod.THIS_YEAR:
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case DashboardPeriod.LAST_YEAR:
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate: start, endDate: end };
  }

  private getDateFormat(period: string): string {
    switch (period) {
      case 'hourly':
        return 'YYYY-MM-DD HH24:00:00';
      case 'daily':
        return 'YYYY-MM-DD';
      case 'weekly':
        return 'YYYY-"W"WW';
      case 'monthly':
        return 'YYYY-MM';
      case 'quarterly':
        return 'YYYY-"Q"Q';
      case 'yearly':
        return 'YYYY';
      default:
        return 'YYYY-MM-DD';
    }
  }

  private async getSalesData(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalSales: number }> {
    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total)', 'totalSales')
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .getRawOne();

    return {
      totalSales: parseFloat(result.totalSales) || 0,
    };
  }

  private async getExpensesData(
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalExpenses: number }> {
    const result = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalExpenses')
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .getRawOne();

    return {
      totalExpenses: parseFloat(result.totalExpenses) || 0,
    };
  }

  private async getInvoiceStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    paid: number;
    pending: number;
    overdue: number;
  }> {
    // Total de facturas en el período
    const total = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .getCount();

    // Facturas pagadas
    const paid = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status = :status', { status: 'paid' })
      .getCount();

    // Facturas pendientes
    const pending = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status = :status', { status: 'pending' })
      .getCount();

    // Facturas vencidas
    const overdue = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.dueDate < :today', { today: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['pending', 'partially_paid'],
      })
      .getCount();

    return { total, paid, pending, overdue };
  }

  private async getCustomerStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    active: number;
    newThisMonth: number;
  }> {
    // Total de clientes
    const total = await this.customerRepository.count();

    // Clientes activos
    const active = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.status = :status', { status: 'active' })
      .getCount();

    // Nuevos clientes en el período
    const newThisMonth = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.createdAt >= :startDate', { startDate })
      .andWhere('customer.createdAt <= :endDate', { endDate })
      .getCount();

    return { total, active, newThisMonth };
  }

  private async getProductStats(): Promise<{
    total: number;
    lowStock: number;
    outOfStock: number;
  }> {
    const total = await this.productRepository.count();

    const lowStock = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock <= product.minStock')
      .andWhere('product.status = :status', { status: 'active' })
      .getCount();

    // Usar stock = 0 en lugar de status problemático
    const outOfStock = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock = 0')
      .getCount();

    return { total, lowStock, outOfStock };
  }
}
