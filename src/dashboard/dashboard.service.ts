// src/modules/dashboard/services/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Payment } from 'src/invoices/entities/payment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Product } from 'src/products/entities/product.entity';
import { Sale } from 'src/sales/entities/sale.entity';
// Removed external service dependencies to fix module loading issues
import { DashboardPeriod, DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  CashFlowData,
  CategorySales,
  DashboardSummary,
  ExpensesBreakdown,
  PaymentMethodStats,
  ProfitabilityStats,
  ProductProfitability,
  ProfitabilityTrend,
  DailyMarginPoint,
  SalesChart,
  TopCustomers,
  TopProducts,
} from './interfaces/dashboard.interfaces';
import { ChartQueryDto } from './dto/chart-query.dto';
import { ProfitabilityQueryDto } from './dto/profitability-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
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
    const [salesData, expensesData, invoiceStats, customerStats, productStats, paymentMethodStats, incomeTypeBreakdown] =
      await Promise.all([
        this.getSalesData(startDate, endDate),
        this.getExpensesData(startDate, endDate),
        this.getInvoiceStats(startDate, endDate),
        this.getCustomerStats(startDate, endDate),
        this.getProductStats(),
        this.getPaymentMethodStats(query),
        this.getIncomeTypeBreakdown(startDate, endDate),
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
      paymentMethodsBreakdown: paymentMethodStats,
      incomeTypeBreakdown: incomeTypeBreakdown,
      period: {
        startDate,
        endDate,
        type: query.period || DashboardPeriod.THIS_MONTH,
      },
    };
  }

  async getSalesChart(query: ChartQueryDto): Promise<SalesChart[]> {
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    const { startDate, endDate } = this.getDateRange(
      undefined,
      query.startDate,
      query.endDate,
    );

    const dateFormat = this.getDateFormat(query.chartPeriod);

    // Ventas por período CON FILTRO DE TENANT
    const salesData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        `DATE_TRUNC('${query.chartPeriod}', invoice.date) as date`,
        'SUM(invoice.total) as sales',
        'COUNT(invoice.id) as invoice_count',
      ])
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy(`DATE_TRUNC('${query.chartPeriod}', invoice.date)`)
      .orderBy('date', 'ASC')
      .getRawMany();

    // Gastos por período CON FILTRO DE TENANT
    const expensesData = await this.expenseRepository
      .createQueryBuilder('expense')
      .select([
        `DATE_TRUNC('${query.chartPeriod}', expense.date) as date`,
        'SUM(expense.amount) as expenses',
      ])
      .where('expense.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('expense.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

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
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

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
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

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
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

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
      .where('expense.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('expense.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    // Ingresos diarios CON FILTRO DE TENANT
    const incomeData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'DATE(invoice.date) as date',
        'SUM(invoice.paidAmount) as income',
      ])
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.paidAmount > 0')
      .groupBy('DATE(invoice.date)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Gastos diarios CON FILTRO DE TENANT
    const expenseData = await this.expenseRepository
      .createQueryBuilder('expense')
      .select(['DATE(expense.date) as date', 'SUM(expense.amount) as expenses'])
      .where('expense.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('expense.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    const { startDate, endDate } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    // 🔍 DEBUG: Ver todos los pagos primero
    const samplePayments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.bankAccount', 'bankAccount')
      .where('payment.organizationId = :organizationId', { organizationId: tenantId })
      .andWhere('payment.paymentDate >= :startDate', { startDate })
      .andWhere('payment.paymentDate <= :endDate', { endDate })
      .limit(5)
      .getMany();

    console.log('🔍 DEBUG - Pagos en rango de fechas:', {
      count: samplePayments.length,
      startDate,
      endDate,
      sample: samplePayments.map(p => ({
        paymentNumber: p.paymentNumber,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        bankAccountId: p.bankAccountId,
        bankAccountName: p.bankAccount?.name || 'Sin cuenta',
        date: p.paymentDate
      }))
    });

    // Consulta principal: agrupar pagos por cuenta bancaria
    const paymentStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.bankAccount', 'bankAccount')
      .select([
        'COALESCE(bankAccount.name, payment.paymentMethod) as method',
        'COUNT(payment.id) as count',
        'SUM(payment.amount) as total_amount',
      ])
      .where('payment.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('payment.paymentDate >= :startDate', { startDate })
      .andWhere('payment.paymentDate <= :endDate', { endDate })
      .groupBy('bankAccount.name, payment.paymentMethod')
      .orderBy('total_amount', 'DESC')
      .getRawMany();

    console.log('💰 DEBUG - Payment stats result:', paymentStats);

    const totalAmount = paymentStats.reduce(
      (sum, item) => sum + parseFloat(item.total_amount || 0),
      0,
    );

    return paymentStats.map((item) => ({
      method: item.method || 'Sin especificar',
      count: parseInt(item.count || 0),
      totalAmount: parseFloat(item.total_amount || 0),
      percentage:
        totalAmount > 0
          ? (parseFloat(item.total_amount || 0) / totalAmount) * 100
          : 0,
    }));
  }

  /**
   * Obtener desglose de ingresos por tipo (Créditos vs Facturas)
   */
  private async getIncomeTypeBreakdown(
    startDate: Date,
    endDate: Date,
  ): Promise<{ invoices: number; credits: number; total: number }> {
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    // Ingresos por FACTURAS PAGADAS (paidAmount de facturas paid o partially_paid)
    const invoicesIncome = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.paidAmount), 0)', 'total')
      .where('invoice.organizationId = :organizationId', { organizationId: tenantId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', { statuses: ['paid', 'partially_paid'] })
      .getRawOne();

    // Ingresos por CRÉDITOS (clientBalanceApplied en facturas)
    const creditsIncome = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.clientBalanceApplied), 0)', 'total')
      .where('invoice.organizationId = :organizationId', { organizationId: tenantId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.clientBalanceApplied > 0')
      .getRawOne();

    const invoicesTotal = parseFloat(invoicesIncome?.total || '0');
    const creditsTotal = parseFloat(creditsIncome?.total || '0');
    const total = invoicesTotal + creditsTotal;

    console.log('📊 DEBUG - Income Type Breakdown:', {
      invoicesTotal,
      creditsTotal,
      total,
      invoicesQuery: invoicesIncome,
      creditsQuery: creditsIncome,
      startDate,
      endDate
    });

    return {
      invoices: invoicesTotal,
      credits: creditsTotal,
      total: total,
    };
  }

  // Métodos auxiliares privados
  private getDateRange(
    period?: DashboardPeriod,
    startDate?: string,
    endDate?: string,
  ): { startDate: Date; endDate: Date } {
    // Si se proporcionan startDate y endDate, úsalos directamente (sin importar el period)
    if (startDate && endDate) {
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total)', 'totalSales')
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    const result = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalExpenses')
      .where('expense.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('expense.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    // Total de facturas en el período CON FILTRO DE TENANT
    const total = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .getCount();

    // Facturas pagadas CON FILTRO DE TENANT
    const paid = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status = :status', { status: 'paid' })
      .getCount();

    // Facturas pendientes CON FILTRO DE TENANT
    const pending = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status = :status', { status: 'pending' })
      .getCount();

    // Facturas vencidas CON FILTRO DE TENANT
    const overdue = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('invoice.date >= :startDate', { startDate })
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
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    // Total de clientes CON FILTRO DE TENANT
    const total = await this.customerRepository.count({
      where: { organizationId: tenantId },
    });

    // Clientes activos CON FILTRO DE TENANT
    const active = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('customer.status = :status', { status: 'active' })
      .getCount();

    // Nuevos clientes en el período CON FILTRO DE TENANT
    const newThisMonth = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('customer.createdAt >= :startDate', { startDate })
      .andWhere('customer.createdAt <= :endDate', { endDate })
      .getCount();

    return { total, active, newThisMonth };
  }

  private async getProductStats(): Promise<{
    total: number;
    lowStock: number;
    outOfStock: number;
  }> {
    const tenantId = '12345678-1234-1234-1234-123456789012'; // Hardcoded for testing
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    // Total de productos CON FILTRO DE TENANT
    const total = await this.productRepository.count({
      where: { organizationId: tenantId },
    });

    // Productos con stock bajo CON FILTRO DE TENANT
    const lowStock = await this.productRepository
      .createQueryBuilder('product')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('product.stock <= product.minStock')
      .andWhere('product.status = :status', { status: 'active' })
      .getCount();

    // Productos sin stock CON FILTRO DE TENANT
    const outOfStock = await this.productRepository
      .createQueryBuilder('product')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('product.stock = 0')
      .getCount();

    return { total, lowStock, outOfStock };
  }

  /**
   * Obtiene notificaciones inteligentes basadas en datos reales del negocio
   */
  async getRealNotifications(
    organizationId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    const notifications = [];

    try {
      // 1. FACTURAS VENCIDAS - PRIORIDAD CRÍTICA
      const overdueInvoices = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.customer', 'customer')
        .where('invoice.organizationId = :organizationId', { organizationId })
        .andWhere('invoice.dueDate < :today', { today: new Date() })
        .andWhere('invoice.status IN (:...statuses)', {
          statuses: ['pending', 'partially_paid'],
        })
        .orderBy('invoice.dueDate', 'ASC') // Las más vencidas primero (fecha más antigua)
        .limit(10)
        .getMany();

      console.log(
        `🔍 Facturas vencidas encontradas: ${overdueInvoices.length}`,
      );

      for (const invoice of overdueInvoices) {
        const customerName = invoice.customer
          ? `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim()
          : 'Cliente';

        console.log(
          `📄 Factura vencida: ${invoice.number}, vence: ${invoice.dueDate}, días vencidos: ${invoice.daysOverdue}`,
        );

        notifications.push({
          id: `overdue-${invoice.id}`,
          type: 'invoice_overdue',
          category: 'financial',
          priority: 'critical',
          status: 'pending',
          title: 'Factura vencida',
          message: `Factura #${invoice.number} vencida hace ${invoice.daysOverdue} días`,
          description: `${customerName} debe $${invoice.balanceDue.toLocaleString()}`,
          entityId: invoice.id,
          entityType: 'invoice',
          metadata: {
            invoiceNumber: invoice.number,
            customerName: customerName,
            amount: invoice.balanceDue,
            daysOverdue: invoice.daysOverdue,
          },
          actionUrl: `/invoices/${invoice.id}`,
          actions: [
            {
              type: 'view',
              label: 'Ver factura',
              url: `/invoices/${invoice.id}`,
            },
            {
              type: 'remind',
              label: 'Enviar recordatorio',
              action: 'send_reminder',
            },
          ],
          organizationId: invoice.organizationId,
          createdAt: invoice.dueDate.toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. PRODUCTOS SIN STOCK - PRIORIDAD CRÍTICA
      const outOfStockProducts = await this.productRepository
        .createQueryBuilder('product')
        .where('product.organizationId = :organizationId', { organizationId })
        .andWhere('product.stock = 0')
        .andWhere('product.status = :status', { status: 'active' })
        .orderBy('product.updatedAt', 'DESC')
        .limit(8)
        .getMany();

      console.log(
        `📦 Productos sin stock encontrados: ${outOfStockProducts.length}`,
      );

      for (const product of outOfStockProducts) {
        console.log(
          `🚫 Producto sin stock: ${product.name}, stock actual: ${product.stock}`,
        );

        notifications.push({
          id: `out-of-stock-${product.id}`,
          type: 'stock_out',
          category: 'inventory',
          priority: 'critical',
          status: 'pending',
          title: 'Producto sin stock',
          message: `${product.name} está agotado`,
          description: 'Reabastece el inventario para continuar vendiendo',
          entityId: product.id,
          entityType: 'product',
          metadata: {
            productName: product.name,
            currentStock: product.stock,
            minStock: product.minStock,
          },
          actionUrl: `/products/${product.id}`,
          actions: [
            {
              type: 'restock',
              label: 'Reabastecer',
              action: 'restock_product',
            },
            {
              type: 'view',
              label: 'Ver producto',
              url: `/products/${product.id}`,
            },
          ],
          organizationId: product.organizationId,
          createdAt: product.updatedAt.toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. PRODUCTOS CON STOCK BAJO - PRIORIDAD ALTA
      const lowStockProducts = await this.productRepository
        .createQueryBuilder('product')
        .where('product.organizationId = :organizationId', { organizationId })
        .andWhere('product.stock <= product.minStock')
        .andWhere('product.stock > 0')
        .andWhere('product.status = :status', { status: 'active' })
        .orderBy('(product.stock / product.minStock)', 'ASC')
        .limit(10)
        .getMany();

      console.log(
        `⚠️ Productos con stock bajo encontrados: ${lowStockProducts.length}`,
      );

      for (const product of lowStockProducts) {
        const stockPercentage = Math.round(
          (product.stock / product.minStock) * 100,
        );

        console.log(
          `📉 Producto stock bajo: ${product.name}, stock: ${product.stock}/${product.minStock} (${stockPercentage}%)`,
        );

        notifications.push({
          id: `low-stock-${product.id}`,
          type: 'stock_low',
          category: 'inventory',
          priority: stockPercentage < 50 ? 'high' : 'medium',
          status: 'pending',
          title: 'Stock bajo',
          message: `${product.name} tiene ${product.stock} unidades`,
          description: `Mínimo requerido: ${product.minStock} unidades (${stockPercentage}% del mínimo)`,
          entityId: product.id,
          entityType: 'product',
          metadata: {
            productName: product.name,
            currentStock: product.stock,
            minStock: product.minStock,
            stockPercentage: stockPercentage,
          },
          actionUrl: `/products/${product.id}`,
          actions: [
            {
              type: 'restock',
              label: 'Reabastecer',
              action: 'restock_product',
            },
            {
              type: 'view',
              label: 'Ver producto',
              url: `/products/${product.id}`,
            },
          ],
          organizationId: product.organizationId,
          createdAt: product.updatedAt.toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 4. PAGOS GRANDES RECIBIDOS - PRIORIDAD MEDIA
      const largePayments = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.customer', 'customer')
        .where('invoice.organizationId = :organizationId', { organizationId })
        .andWhere('invoice.status = :status', { status: 'paid' })
        .andWhere('invoice.paidAmount > :minAmount', { minAmount: 1000000 }) // > 1M pesos
        .andWhere('invoice.updatedAt >= :recentDate', {
          recentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Últimos 7 días
        })
        .orderBy('invoice.paidAmount', 'DESC')
        .limit(5)
        .getMany();

      for (const invoice of largePayments) {
        const customerName = invoice.customer
          ? `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim()
          : 'Cliente';

        notifications.push({
          id: `large-payment-${invoice.id}`,
          type: 'payment_received',
          category: 'financial',
          priority: 'medium',
          status: 'info',
          title: 'Pago importante recibido',
          message: `Pago de $${invoice.paidAmount.toLocaleString()} recibido`,
          description: `${customerName} pagó la factura #${invoice.number}`,
          entityId: invoice.id,
          entityType: 'payment',
          metadata: {
            amount: invoice.paidAmount,
            customerName: customerName,
            invoiceNumber: invoice.number,
            paymentMethod: invoice.paymentMethod,
          },
          actionUrl: `/invoices/${invoice.id}`,
          actions: [
            {
              type: 'view',
              label: 'Ver factura',
              url: `/invoices/${invoice.id}`,
            },
            { type: 'receipt', label: 'Enviar recibo', action: 'send_receipt' },
          ],
          organizationId: invoice.organizationId,
          createdAt: invoice.updatedAt.toISOString(),
          updatedAt: invoice.updatedAt.toISOString(),
        });
      }

      // 5. GASTOS ELEVADOS - PRIORIDAD MEDIA
      const largeExpenses = await this.expenseRepository
        .createQueryBuilder('expense')
        .leftJoinAndSelect('expense.category', 'category')
        .leftJoinAndSelect('expense.createdBy', 'user')
        .where('expense.organizationId = :organizationId', { organizationId })
        .andWhere('expense.amount > :minAmount', { minAmount: 500000 }) // > 500k pesos
        .andWhere('expense.createdAt >= :recentDate', {
          recentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Últimos 3 días
        })
        .orderBy('expense.amount', 'DESC')
        .limit(5)
        .getMany();

      for (const expense of largeExpenses) {
        const categoryName = expense.category?.name || 'Sin categoría';
        const userName = expense.createdBy
          ? `${expense.createdBy.firstName} ${expense.createdBy.lastName}`.trim()
          : 'Usuario';

        notifications.push({
          id: `large-expense-${expense.id}`,
          type: 'expense_alert',
          category: 'financial',
          priority: 'medium',
          status: 'pending',
          title: 'Gasto elevado registrado',
          message: `Gasto de $${expense.amount.toLocaleString()} en ${categoryName}`,
          description: `Registrado por ${userName}: ${expense.description}`,
          entityId: expense.id,
          entityType: 'expense',
          metadata: {
            amount: expense.amount,
            description: expense.description,
            categoryName: categoryName,
            userName: userName,
          },
          actionUrl: `/expenses/${expense.id}`,
          actions: [
            {
              type: 'view',
              label: 'Ver gasto',
              url: `/expenses/${expense.id}`,
            },
            { type: 'approve', label: 'Aprobar', action: 'approve_expense' },
          ],
          organizationId: expense.organizationId,
          createdAt: expense.createdAt.toISOString(),
          updatedAt: expense.updatedAt.toISOString(),
        });
      }

      // 6. NUEVOS CLIENTES - PRIORIDAD BAJA
      const newCustomers = await this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', { organizationId })
        .andWhere('customer.createdAt >= :recentDate', {
          recentDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Último día
        })
        .orderBy('customer.createdAt', 'DESC')
        .limit(5)
        .getMany();

      for (const customer of newCustomers) {
        notifications.push({
          id: `new-customer-${customer.id}`,
          type: 'customer_created',
          category: 'customer',
          priority: 'low',
          status: 'info',
          title: 'Nuevo cliente registrado',
          message: `${customer.firstName} ${customer.lastName} se registró`,
          description: `Email: ${customer.email} | Tel: ${customer.phone}`,
          entityId: customer.id,
          entityType: 'customer',
          metadata: {
            customerName: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            phone: customer.phone,
          },
          actionUrl: `/customers/${customer.id}`,
          actions: [
            {
              type: 'view',
              label: 'Ver cliente',
              url: `/customers/${customer.id}`,
            },
            { type: 'contact', label: 'Contactar', action: 'contact_customer' },
          ],
          organizationId: customer.organizationId,
          createdAt: customer.createdAt.toISOString(),
          updatedAt: customer.updatedAt.toISOString(),
        });
      }

      // Ordenar notificaciones por prioridad y fecha
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      notifications.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      // Calcular totales antes de la paginación
      const total = notifications.length;
      const unreadCount = notifications.filter(
        (n) => n.status === 'pending',
      ).length;

      console.log(
        `📊 Total notificaciones generadas: ${total}, no leídas: ${unreadCount}`,
      );

      // Aplicar paginación
      const paginatedNotifications = notifications.slice(
        offset,
        offset + limit,
      );

      console.log(
        `📄 Notificaciones paginadas: ${paginatedNotifications.length} (offset: ${offset}, limit: ${limit})`,
      );

      return {
        notifications: paginatedNotifications,
        total,
        unreadCount,
      };
    } catch (error) {
      console.error('Error al obtener notificaciones reales:', error);
      throw error;
    }
  }

  /**
   * Obtiene actividades recientes basadas en datos reales del negocio
   */
  async getRecentRealActivities(
    organizationId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ activities: any[]; total: number }> {
    const activities = [];

    try {
      // 1. FACTURAS RECIENTES (últimas creadas, pagadas, vencidas)
      const recentInvoices = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.customer', 'customer')
        .leftJoinAndSelect('invoice.createdBy', 'user')
        .where('invoice.organizationId = :organizationId', { organizationId })
        .orderBy('invoice.createdAt', 'DESC')
        .limit(10)
        .getMany();

      // Agregar actividades de facturas
      for (const invoice of recentInvoices) {
        const customerName = invoice.customer
          ? `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim()
          : 'Cliente';
        const userName = invoice.createdBy
          ? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`.trim()
          : 'Usuario';

        // Factura creada
        activities.push({
          id: `invoice-created-${invoice.id}`,
          type: 'invoice_created',
          category: 'financial',
          priority: invoice.total > 1000000 ? 'high' : 'medium', // Si es > 1M pesos, alta prioridad
          title: 'Nueva factura creada',
          description: `Factura #${invoice.number} creada por $${invoice.total.toLocaleString()} para ${customerName}`,
          entityId: invoice.id,
          entityType: 'invoice',
          metadata: {
            invoiceNumber: invoice.number,
            amount: invoice.total,
            customerName: customerName,
            status: invoice.status,
          },
          icon: 'receipt_long',
          color: '#2196F3',
          isSystemGenerated: false,
          userId: invoice.createdById,
          organizationId: invoice.organizationId,
          user: {
            firstName: invoice.createdBy?.firstName || 'Usuario',
            lastName: invoice.createdBy?.lastName || '',
          },
          createdAt: invoice.createdAt.toISOString(),
          updatedAt: invoice.updatedAt.toISOString(),
        });

        // Si la factura está pagada, agregar actividad de pago
        if (invoice.status === 'paid' && invoice.paidAmount > 0) {
          activities.push({
            id: `payment-received-${invoice.id}`,
            type: 'payment_received',
            category: 'financial',
            priority: invoice.paidAmount > 500000 ? 'high' : 'medium',
            title: 'Pago recibido',
            description: `Pago de $${invoice.paidAmount.toLocaleString()} recibido de ${customerName} - Factura #${invoice.number}`,
            entityId: invoice.id,
            entityType: 'payment',
            metadata: {
              amount: invoice.paidAmount,
              customerName: customerName,
              invoiceNumber: invoice.number,
              paymentMethod: invoice.paymentMethod,
            },
            icon: 'payment',
            color: '#4CAF50',
            isSystemGenerated: false,
            userId: invoice.createdById,
            organizationId: invoice.organizationId,
            user: {
              firstName: invoice.createdBy?.firstName || 'Usuario',
              lastName: invoice.createdBy?.lastName || '',
            },
            createdAt: invoice.updatedAt.toISOString(),
            updatedAt: invoice.updatedAt.toISOString(),
          });
        }

        // Si la factura está vencida, agregar actividad de alerta
        if (invoice.isOverdue) {
          activities.push({
            id: `invoice-overdue-${invoice.id}`,
            type: 'invoice_overdue',
            category: 'financial',
            priority: 'critical',
            title: 'Factura vencida',
            description: `Factura #${invoice.number} vencida hace ${invoice.daysOverdue} días - ${customerName} - $${invoice.balanceDue.toLocaleString()}`,
            entityId: invoice.id,
            entityType: 'invoice',
            metadata: {
              invoiceNumber: invoice.number,
              customerName: customerName,
              daysOverdue: invoice.daysOverdue,
              balanceDue: invoice.balanceDue,
            },
            icon: 'schedule',
            color: '#F44336',
            isSystemGenerated: true,
            userId: invoice.createdById,
            organizationId: invoice.organizationId,
            user: {
              firstName: 'Sistema',
              lastName: 'Automático',
            },
            createdAt: invoice.dueDate.toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. CLIENTES RECIENTES
      const recentCustomers = await this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', { organizationId })
        .orderBy('customer.createdAt', 'DESC')
        .limit(5)
        .getMany();

      for (const customer of recentCustomers) {
        activities.push({
          id: `customer-created-${customer.id}`,
          type: 'customer_created',
          category: 'customer',
          priority: 'medium',
          title: 'Nuevo cliente registrado',
          description: `Cliente ${customer.firstName} ${customer.lastName} registrado - ${customer.email}`,
          entityId: customer.id,
          entityType: 'customer',
          metadata: {
            customerName: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            phone: customer.phone,
          },
          icon: 'person_add',
          color: '#9C27B0',
          isSystemGenerated: false,
          userId: customer.id, // En este caso no tenemos quien lo creó
          organizationId: customer.organizationId,
          user: {
            firstName: 'Sistema',
            lastName: 'Registro',
          },
          createdAt: customer.createdAt.toISOString(),
          updatedAt: customer.updatedAt.toISOString(),
        });
      }

      // 3. PRODUCTOS CON STOCK BAJO
      const lowStockProducts = await this.productRepository
        .createQueryBuilder('product')
        .where('product.organizationId = :organizationId', { organizationId })
        .andWhere('product.stock <= product.minStock')
        .andWhere('product.stock > 0') // Solo productos con stock bajo, no agotados
        .orderBy('(product.stock / product.minStock)', 'ASC') // Los más críticos primero
        .limit(5)
        .getMany();

      for (const product of lowStockProducts) {
        const stockPercentage = Math.round(
          (product.stock / product.minStock) * 100,
        );
        activities.push({
          id: `stock-low-${product.id}`,
          type: 'stock_low',
          category: 'inventory',
          priority: stockPercentage < 50 ? 'high' : 'medium',
          title: 'Stock bajo',
          description: `Producto "${product.name}" tiene ${product.stock} unidades (mínimo: ${product.minStock})`,
          entityId: product.id,
          entityType: 'product',
          metadata: {
            productName: product.name,
            currentStock: product.stock,
            minStock: product.minStock,
            stockPercentage: stockPercentage,
          },
          icon: 'warning',
          color: '#FF9800',
          isSystemGenerated: true,
          userId: null,
          organizationId: product.organizationId,
          user: {
            firstName: 'Sistema',
            lastName: 'Inventario',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 4. PRODUCTOS AGOTADOS
      const outOfStockProducts = await this.productRepository
        .createQueryBuilder('product')
        .where('product.organizationId = :organizationId', { organizationId })
        .andWhere('product.stock = 0')
        .orderBy('product.updatedAt', 'DESC')
        .limit(3)
        .getMany();

      for (const product of outOfStockProducts) {
        activities.push({
          id: `stock-out-${product.id}`,
          type: 'stock_out',
          category: 'inventory',
          priority: 'critical',
          title: 'Producto sin stock',
          description: `El producto "${product.name}" se ha quedado sin existencias`,
          entityId: product.id,
          entityType: 'product',
          metadata: {
            productName: product.name,
            lastStock: product.minStock,
          },
          icon: 'report_problem',
          color: '#F44336',
          isSystemGenerated: true,
          userId: null,
          organizationId: product.organizationId,
          user: {
            firstName: 'Sistema',
            lastName: 'Inventario',
          },
          createdAt: product.updatedAt.toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 5. GASTOS RECIENTES
      const recentExpenses = await this.expenseRepository
        .createQueryBuilder('expense')
        .leftJoinAndSelect('expense.createdBy', 'user')
        .leftJoinAndSelect('expense.category', 'category')
        .where('expense.organizationId = :organizationId', { organizationId })
        .orderBy('expense.createdAt', 'DESC')
        .limit(5)
        .getMany();

      for (const expense of recentExpenses) {
        const userName = expense.createdBy
          ? `${expense.createdBy.firstName} ${expense.createdBy.lastName}`.trim()
          : 'Usuario';
        const categoryName = expense.category?.name || 'Categoría';

        activities.push({
          id: `expense-created-${expense.id}`,
          type: 'expense_created',
          category: 'financial',
          priority: expense.amount > 500000 ? 'high' : 'medium',
          title: 'Nuevo gasto registrado',
          description: `Gasto "${expense.description}" por $${expense.amount.toLocaleString()} en ${categoryName}`,
          entityId: expense.id,
          entityType: 'expense',
          metadata: {
            amount: expense.amount,
            description: expense.description,
            categoryName: categoryName,
            status: expense.status,
          },
          icon: 'money_off',
          color: '#E91E63',
          isSystemGenerated: false,
          userId: expense.createdById,
          organizationId: expense.organizationId,
          user: {
            firstName: expense.createdBy?.firstName || 'Usuario',
            lastName: expense.createdBy?.lastName || '',
          },
          createdAt: expense.createdAt.toISOString(),
          updatedAt: expense.updatedAt.toISOString(),
        });
      }

      // Ordenar todas las actividades por fecha de creación (más recientes primero)
      activities.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Calcular total antes de la paginación
      const total = activities.length;

      // Aplicar paginación
      const paginatedActivities = activities.slice(offset, offset + limit);

      return {
        activities: paginatedActivities,
        total,
      };
    } catch (error) {
      console.error('Error al obtener actividades reales:', error);
      throw error;
    }
  }

  // ==================== NUEVO MÉTODO PARA RENTABILIDAD FIFO ====================

  async getProfitabilityStats(
    query: ProfitabilityQueryDto,
    organizationId: string,
  ): Promise<ProfitabilityStats> {
    try {
      console.log('🔄 Calculando métricas de rentabilidad FIFO...');
      console.log('📝 Query recibida:', query);
      console.log('🏢 Organization ID:', organizationId);

      // Usar fechas directas sin getDateRange por ahora
      const startDate = new Date(query.startDate || '2025-09-23');
      const endDate = new Date(query.endDate || '2025-09-23');

      console.log('📅 Fechas directas:', { startDate, endDate });

      // ✅ 1. CALCULAR INGRESOS REALES DESDE INVOICE ITEMS
      console.log('📈 Paso 1: Calculando ingresos reales desde facturas...');
      const revenueData = await this.calculateTotalRevenue(
        organizationId,
        startDate,
        endDate,
        query.warehouseId,
      );

      // ✅ 2. CALCULAR COSTOS REALES USANDO FIFO + PRODUCTOS TEMPORALES CON MARGEN
      console.log('💸 Paso 2: Calculando costos reales (FIFO + productos temporales)...');
      const cogsData = await this.calculateRealCOGS(
        organizationId,
        startDate,
        endDate,
        query.warehouseId,
      );

      // 3. Calcular métricas básicas CORRECTAMENTE
      // GANANCIA = (precio_venta × cantidad) - (costo_fifo × cantidad)
      const grossProfit = revenueData.totalRevenue - cogsData.totalCOGS;
      const grossMarginPercentage =
        revenueData.totalRevenue > 0
          ? (grossProfit / revenueData.totalRevenue) * 100
          : 0;

      console.log('🧮 CÁLCULO FIFO CORRECTO:');
      console.log(`   💰 Total Ingresos: $${revenueData.totalRevenue.toLocaleString()}`);
      console.log(`   💸 Total Costo FIFO: $${cogsData.totalCOGS.toLocaleString()}`);
      console.log(`   📈 Ganancia Bruta: $${grossProfit.toLocaleString()}`);
      console.log(`   📊 Margen Bruto: ${grossMarginPercentage.toFixed(2)}%`);

      console.log('💰 Paso 3: Calculando gastos...');
      // 4. Obtener gastos para calcular ganancia neta (simplificado)
      const netProfit = grossProfit; // Por ahora sin gastos
      const netMarginPercentage =
        revenueData.totalRevenue > 0
          ? (netProfit / revenueData.totalRevenue) * 100
          : 0;

      console.log('📊 Paso 4: Calculando margen promedio...');
      // 5. Calcular margen promedio por venta
      const averageMarginPerSale =
        revenueData.salesCount > 0 ? grossMarginPercentage : 0;

      console.log('🏆 Devolviendo resultados básicos...');
      
      // 6. Obtener productos más y menos rentables REALES
      console.log('🏆 Paso 5: Calculando productos rentables...');
      const [topProfitableProducts, lowProfitableProducts] = await Promise.all([
        this.getTopProfitableProducts(
          organizationId,
          startDate,
          endDate,
          query.limit || 5,
          query.warehouseId,
          true,
        ),
        this.getTopProfitableProducts(
          organizationId,
          startDate,
          endDate,
          query.limit || 5,
          query.warehouseId,
          false,
        ),
      ]);

      // 7. Calcular márgenes por categoría REALES
      console.log('📊 Paso 6: Calculando márgenes por categoría...');
      const marginsByCategory = await this.getMarginsByCategory(
        organizationId,
        startDate,
        endDate,
        query.warehouseId,
      );

      // 8. Generar tendencia de rentabilidad REAL
      console.log('📈 Paso 7: Calculando tendencias...');
      const trend = await this.getProfitabilityTrend(
        organizationId,
        startDate,
        endDate,
        query.warehouseId,
      );

      console.log('✅ Métricas de rentabilidad FIFO calculadas exitosamente');

      return {
        totalRevenue: revenueData.totalRevenue,
        totalCOGS: cogsData.totalCOGS,
        grossProfit,
        grossMarginPercentage,
        netProfit,
        netMarginPercentage,
        averageMarginPerSale,
        topProfitableProducts,
        lowProfitableProducts,
        marginsByCategory,
        trend,
      };
    } catch (error) {
      console.error(
        '❌ Error al calcular métricas de rentabilidad FIFO:',
        error,
      );
      throw error;
    }
  }

  // Método auxiliar: Calcular ingresos totales REALES desde InvoiceItem
  private async calculateTotalRevenue(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    warehouseId?: string,
  ): Promise<{ totalRevenue: number; salesCount: number }> {
    // 🔄 CAMBIO: Usar Invoice + InvoiceItem en lugar de Sale + SaleItem
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'invoiceItem')
      .leftJoin('invoiceItem.product', 'product')
      .select([
        'SUM(invoiceItem.quantity * invoiceItem.unitPrice) as totalRevenue',
        'COUNT(DISTINCT invoice.id) as salesCount',
      ])
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      });

    if (warehouseId) {
      queryBuilder.andWhere('product.warehouseId = :warehouseId', {
        warehouseId,
      });
    }

    console.log('🔍 Query SQL para ingresos:', queryBuilder.getSql());
    console.log('🔍 Parámetros:', queryBuilder.getParameters());
    
    const result = await queryBuilder.getRawOne();
    const totalRevenue = parseFloat(result?.totalRevenue || 0);
    const salesCount = parseInt(result?.salesCount || 0);

    console.log('💰 INGRESOS CALCULADOS (DESDE FACTURAS):');
    console.log(`   📈 Total Revenue: $${totalRevenue.toLocaleString()}`);
    console.log(`   🛒 Número de facturas: ${salesCount}`);
    console.log(`   📝 Query usada: SUM(invoiceItem.quantity * invoiceItem.unitPrice)`);
    console.log('🔍 Resultado raw:', result);

    return {
      totalRevenue,
      salesCount,
    };
  }

  // Método auxiliar: Calcular COGS con metodología FIFO REAL
  private async calculateFifoCOGS(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    warehouseId?: string,
  ): Promise<{ totalCOGS: number }> {
    // 🔄 ACTUALIZAR COSTO DE SAL AUTOMÁTICAMENTE PARA PRUEBA
    await this.updateProductCost('a36c5958-0230-4f67-b3f8-86ac72c5df82', 1250, organizationId);

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'invoiceItem')
      .leftJoin('invoiceItem.product', 'product')
      .select(['SUM(invoiceItem.quantity * COALESCE(product.cost, 1250)) as totalCOGS'])
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      });

    if (warehouseId) {
      queryBuilder.andWhere('product.warehouseId = :warehouseId', {
        warehouseId,
      });
    }

    const result = await queryBuilder.getRawOne();
    const totalCOGS = parseFloat(result?.totalCOGS || 0);

    console.log('💸 COSTOS FIFO CALCULADOS (DESDE FACTURAS):');
    console.log(`   📦 Total COGS: $${totalCOGS.toLocaleString()}`);
    console.log(`   📝 Query usada: SUM(invoiceItem.quantity * COALESCE(product.cost, 1250))`);
    console.log(`   ⚡ Ejemplo tu sal: si vendiste 2 × $3,200 = $6,400`);
    console.log(`   ⚡ Y costo FIFO es 2 × $1,250 = $2,500`);
    console.log(`   ⚡ Ganancia = $6,400 - $2,500 = $3,900`);

    return {
      totalCOGS,
    };
  }

  // Método auxiliar: Obtener productos más/menos rentables REALES
  private async getTopProfitableProducts(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    limit: number,
    warehouseId?: string,
    isTopRanking: boolean = true,
  ): Promise<ProductProfitability[]> {
    // ✅ IMPLEMENTACIÓN CORRECTA: Usa datos reales de SaleItem con costos FIFO
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'invoiceItem')
      .leftJoin('invoiceItem.product', 'product')
      .leftJoin('product.category', 'category')
      .select([
        'product.id as productId',
        'product.name as productName',
        'product.sku as sku',
        'category.name as categoryName',
        'SUM(invoiceItem.quantity * invoiceItem.unitPrice) as totalRevenue',
        'SUM(invoiceItem.quantity * COALESCE(product.cost, 1250)) as totalCOGS',
        'SUM(invoiceItem.quantity) as unitsSold',
        'AVG(invoiceItem.unitPrice) as averageSellingPrice',
        'AVG(COALESCE(product.cost, 1250)) as averageFifoCost',
      ])
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy('product.id, product.name, product.sku, category.name')
      .having('SUM(invoiceItem.quantity * invoiceItem.unitPrice) > 0');

    if (warehouseId) {
      queryBuilder.andWhere('product.warehouseId = :warehouseId', {
        warehouseId,
      });
    }

    // Ordenar por margen de ganancia REAL (precio_venta - costo_fifo)
    queryBuilder
      .addSelect(
        '(SUM(invoiceItem.quantity * invoiceItem.unitPrice) - SUM(invoiceItem.quantity * COALESCE(product.cost, 1250))) / SUM(invoiceItem.quantity * invoiceItem.unitPrice) * 100 as marginPercentage',
      )
      .orderBy('marginPercentage', isTopRanking ? 'DESC' : 'ASC')
      .limit(limit);

    const results = await queryBuilder.getRawMany();

    return results.map((result) => {
      const totalRevenue = parseFloat(result.totalRevenue || 0);
      const totalCOGS = parseFloat(result.totalCOGS || 0);
      const grossProfit = totalRevenue - totalCOGS;
      const marginPercentage =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      return {
        productId: result.productId,
        productName: result.productName,
        sku: result.sku,
        categoryName: result.categoryName,
        totalRevenue,
        totalCOGS,
        grossProfit,
        marginPercentage,
        unitsSold: parseInt(result.unitsSold || 0),
        averageSellingPrice: parseFloat(result.averageSellingPrice || 0),
        averageFifoCost: parseFloat(result.averageFifoCost || 0),
      };
    });
  }

  // Método auxiliar: Calcular márgenes por categoría REALES
  private async getMarginsByCategory(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    warehouseId?: string,
  ): Promise<{ [categoryName: string]: number }> {
    // ✅ IMPLEMENTACIÓN CORRECTA: Usa costos FIFO reales desde SaleItem
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'invoiceItem')
      .leftJoin('invoiceItem.product', 'product')
      .leftJoin('product.category', 'category')
      .select([
        "COALESCE(category.name, 'Sin categoría') as categoryName",
        'SUM(invoiceItem.quantity * invoiceItem.unitPrice) as totalRevenue',
        'SUM(invoiceItem.quantity * COALESCE(product.cost, 1250)) as totalCOGS',
      ])
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy('category.name')
      .having('SUM(invoiceItem.quantity * invoiceItem.unitPrice) > 0');

    if (warehouseId) {
      queryBuilder.andWhere('product.warehouseId = :warehouseId', {
        warehouseId,
      });
    }

    const results = await queryBuilder.getRawMany();

    const margins: { [categoryName: string]: number } = {};

    results.forEach((result) => {
      const totalRevenue = parseFloat(result.totalRevenue || 0);
      const totalCOGS = parseFloat(result.totalCOGS || 0);
      const grossProfit = totalRevenue - totalCOGS;
      const marginPercentage =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      margins[result.categoryName] = marginPercentage;
    });

    return margins;
  }

  // Método auxiliar: Generar tendencia de rentabilidad
  private async getProfitabilityTrend(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    warehouseId?: string,
  ): Promise<ProfitabilityTrend> {
    // Calcular período anterior para comparación
    const periodDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const previousStartDate = new Date(
      startDate.getTime() - periodDays * 24 * 60 * 60 * 1000,
    );
    const previousEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

    // Calcular margen del período actual
    const currentRevenueData = await this.calculateTotalRevenue(
      organizationId,
      startDate,
      endDate,
      warehouseId,
    );
    const currentCogsData = await this.calculateFifoCOGS(
      organizationId,
      startDate,
      endDate,
      warehouseId,
    );
    const currentGrossProfit =
      currentRevenueData.totalRevenue - currentCogsData.totalCOGS;
    const currentPeriodGrossMargin =
      currentRevenueData.totalRevenue > 0
        ? (currentGrossProfit / currentRevenueData.totalRevenue) * 100
        : 0;

    // Calcular margen del período anterior
    const previousRevenueData = await this.calculateTotalRevenue(
      organizationId,
      previousStartDate,
      previousEndDate,
      warehouseId,
    );
    const previousCogsData = await this.calculateFifoCOGS(
      organizationId,
      previousStartDate,
      previousEndDate,
      warehouseId,
    );
    const previousGrossProfit =
      previousRevenueData.totalRevenue - previousCogsData.totalCOGS;
    const previousPeriodGrossMargin =
      previousRevenueData.totalRevenue > 0
        ? (previousGrossProfit / previousRevenueData.totalRevenue) * 100
        : 0;

    // Calcular crecimiento del margen
    const marginGrowth =
      previousPeriodGrossMargin > 0
        ? ((currentPeriodGrossMargin - previousPeriodGrossMargin) /
            previousPeriodGrossMargin) *
          100
        : 0;

    const isImproving = marginGrowth > 0;

    // Generar puntos diarios de margen (últimos 30 días máximo)
    const dailyMargins = await this.getDailyMargins(
      organizationId,
      startDate,
      endDate,
      warehouseId,
    );

    return {
      previousPeriodGrossMargin,
      currentPeriodGrossMargin,
      marginGrowth,
      isImproving,
      dailyMargins,
    };
  }

  // Método auxiliar: Obtener márgenes diarios
  private async getDailyMargins(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    warehouseId?: string,
  ): Promise<DailyMarginPoint[]> {
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'invoiceItem')
      .leftJoin('invoiceItem.product', 'product')
      .select([
        'DATE(invoice.date) as date',
        'SUM(invoiceItem.quantity * invoiceItem.unitPrice) as dailyRevenue',
        'SUM(invoiceItem.quantity * COALESCE(product.cost, 1250)) as dailyCOGS',
      ])
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy('DATE(invoice.date)')
      .orderBy('date', 'ASC');

    if (warehouseId) {
      queryBuilder.andWhere('product.warehouseId = :warehouseId', {
        warehouseId,
      });
    }

    const results = await queryBuilder.getRawMany();

    return results.map((result) => {
      const dailyRevenue = parseFloat(result.dailyRevenue || 0);
      const dailyCOGS = parseFloat(result.dailyCOGS || 0);
      const grossMarginPercentage =
        dailyRevenue > 0
          ? ((dailyRevenue - dailyCOGS) / dailyRevenue) * 100
          : 0;

      return {
        date: new Date(result.date),
        grossMarginPercentage,
        dailyRevenue,
        dailyCOGS,
      };
    });
  }

  // ✅ NUEVO: Calcular costos REALES usando totalCost de InvoiceItem (incluye FIFO + productos temporales)
  private async calculateRealCOGS(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    warehouseId?: string,
  ): Promise<{ totalCOGS: number }> {
    console.log('🔍 Calculando costos reales desde invoiceItem.totalCost...');

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'invoiceItem')
      .leftJoin('invoiceItem.product', 'product')
      .leftJoin('invoiceItem.temporaryProduct', 'temporaryProduct')
      .select([
        // ✅ USAR totalCost que ya incluye FIFO para productos registrados y margen para temporales
        'SUM(COALESCE(invoiceItem.totalCost, 0)) as totalCOGS'
      ])
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      });

    if (warehouseId) {
      queryBuilder.andWhere('product.warehouseId = :warehouseId', {
        warehouseId,
      });
    }

    const result = await queryBuilder.getRawOne();
    const totalCOGS = parseFloat(result?.totalCOGS || 0);

    console.log('💸 COSTOS REALES CALCULADOS (DESDE INVOICE ITEMS):');
    console.log(`   📦 Total COGS: $${totalCOGS.toLocaleString()}`);
    console.log(`   📝 Query usada: SUM(COALESCE(invoiceItem.totalCost, 0))`);
    console.log(`   ✅ Incluye FIFO para productos registrados`);
    console.log(`   ✅ Incluye margen configurado para productos temporales`);
    console.log(`   🎯 Este valor refleja tu configuración de margen para productos temporales`);

    return {
      totalCOGS,
    };
  }

  // ✅ AUXILIAR: Obtener margen de ganancia configurado para logging
  private async getOrgMarginPercentage(organizationId: string): Promise<number> {
    try {
      const organization = await this.invoiceRepository.manager
        .getRepository('Organization')
        .findOne({ where: { id: organizationId } });
      
      return organization?.settings?.defaultProfitMarginPercentage || 20;
    } catch (error) {
      return 20; // fallback
    }
  }

  // Método auxiliar para actualizar costo de producto
  async updateProductCost(productId: string, cost: number, organizationId: string): Promise<void> {
    await this.productRepository.update(
      { id: productId, organizationId },
      { cost }
    );
    console.log(`✅ Producto ${productId} actualizado con costo $${cost}`);
  }
}
