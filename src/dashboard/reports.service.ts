// src/modules/dashboard/services/reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Product } from 'src/products/entities/product.entity';
import { Repository } from 'typeorm';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';
import { ReportData } from './interfaces/reports.interfaces';

@Injectable()
export class ReportsService {
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

  async generateReport(
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    const { startDate, endDate } = this.getDateRange(
      query.startDate,
      query.endDate,
    );

    switch (query.reportType) {
      case ReportType.SALES_SUMMARY:
        return this.generateSalesSummaryReport(
          startDate,
          endDate,
          query,
          userId,
        );
      case ReportType.EXPENSE_REPORT:
        return this.generateExpenseReport(startDate, endDate, query, userId);
      case ReportType.PROFIT_LOSS:
        return this.generateProfitLossReport(startDate, endDate, query, userId);
      case ReportType.CUSTOMER_ANALYSIS:
        return this.generateCustomerAnalysisReport(
          startDate,
          endDate,
          query,
          userId,
        );
      case ReportType.PRODUCT_PERFORMANCE:
        return this.generateProductPerformanceReport(
          startDate,
          endDate,
          query,
          userId,
        );
      case ReportType.CASH_FLOW:
        return this.generateCashFlowReport(startDate, endDate, query, userId);
      case ReportType.TAX_REPORT:
        return this.generateTaxReport(startDate, endDate, query, userId);
      case ReportType.INVENTORY_REPORT:
        return this.generateInventoryReport(startDate, endDate, query, userId);
      default:
        throw new Error('Tipo de reporte no soportado');
    }
  }

  private async generateSalesSummaryReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // Resumen de ventas
    const summary = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'COUNT(invoice.id) as total_invoices',
        'SUM(invoice.total) as total_sales',
        'AVG(invoice.total) as average_invoice',
        'SUM(invoice.paidAmount) as total_collected',
        'SUM(invoice.balanceDue) as total_pending',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .getRawOne();

    // Top clientes
    const topCustomers = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.customer', 'customer')
      .select([
        'customer.firstName as first_name',
        'customer.lastName as last_name',
        'customer.companyName as company_name',
        'COUNT(invoice.id) as invoice_count',
        'SUM(invoice.total) as total_sales',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy(
        'customer.id, customer.firstName, customer.lastName, customer.companyName',
      )
      .orderBy('total_sales', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      title: query.title || 'Reporte de Resumen de Ventas',
      description:
        query.description ||
        `Resumen de ventas del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        totalInvoices: parseInt(summary.total_invoices) || 0,
        totalSales: parseFloat(summary.total_sales) || 0,
        averageInvoice: parseFloat(summary.average_invoice) || 0,
        totalCollected: parseFloat(summary.total_collected) || 0,
        totalPending: parseFloat(summary.total_pending) || 0,
        topCustomers: topCustomers.map((item) => ({
          customerName: `${item.first_name} ${item.last_name}`,
          companyName: item.company_name,
          invoiceCount: parseInt(item.invoice_count),
          totalSales: parseFloat(item.total_sales),
        })),
      },
      details: query.includeDetails
        ? await this.getSalesDetails(startDate, endDate)
        : [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  private async generateExpenseReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // Resumen de gastos
    const summary = await this.expenseRepository
      .createQueryBuilder('expense')
      .select([
        'COUNT(expense.id) as total_expenses',
        'SUM(expense.amount) as total_amount',
        'AVG(expense.amount) as average_expense',
      ])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .getRawOne();

    // Gastos por categoría
    const expensesByCategory = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select([
        'category.name as category_name',
        'COUNT(expense.id) as count',
        'SUM(expense.amount) as total',
      ])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .groupBy('category.id, category.name')
      .orderBy('total', 'DESC')
      .getRawMany();

    return {
      title: query.title || 'Reporte de Gastos',
      description:
        query.description ||
        `Análisis de gastos del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        totalExpenses: parseInt(summary.total_expenses) || 0,
        totalAmount: parseFloat(summary.total_amount) || 0,
        averageExpense: parseFloat(summary.average_expense) || 0,
        expensesByCategory: expensesByCategory.map((item) => ({
          categoryName: item.category_name,
          count: parseInt(item.count),
          total: parseFloat(item.total),
        })),
      },
      details: query.includeDetails
        ? await this.getExpenseDetails(startDate, endDate)
        : [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  private async generateProfitLossReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // Ingresos
    const income = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'SUM(invoice.total) as total_revenue',
        'SUM(invoice.paidAmount) as collected_revenue',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .getRawOne();

    // Gastos totales
    const expenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount) as total_expenses')
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ['approved', 'paid'],
      })
      .getRawOne();

    const totalRevenue = parseFloat(income.total_revenue) || 0;
    const totalExpenses = parseFloat(expenses.total_expenses) || 0;
    const grossProfit = totalRevenue - totalExpenses;
    const profitMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      title: query.title || 'Estado de Resultados',
      description:
        query.description ||
        `Estado de Pérdidas y Ganancias del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        totalRevenue,
        collectedRevenue: parseFloat(income.collected_revenue) || 0,
        totalExpenses,
        grossProfit,
        profitMargin,
      },
      details: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  private async generateCustomerAnalysisReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // Top clientes
    const topCustomers = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.customer', 'customer')
      .select([
        'customer.firstName as first_name',
        'customer.lastName as last_name',
        'customer.companyName as company_name',
        'customer.email as email',
        'COUNT(invoice.id) as invoice_count',
        'SUM(invoice.total) as total_sales',
        'AVG(invoice.total) as avg_order_value',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .groupBy(
        'customer.id, customer.firstName, customer.lastName, customer.companyName, customer.email',
      )
      .orderBy('total_sales', 'DESC')
      .limit(20)
      .getRawMany();

    // Nuevos clientes - usando TypeORM correcto
    const newCustomers = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.createdAt >= :startDate', { startDate })
      .andWhere('customer.createdAt <= :endDate', { endDate })
      .getCount();

    return {
      title: query.title || 'Análisis de Clientes',
      description:
        query.description ||
        `Análisis detallado de clientes del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        newCustomers,
        topCustomers: topCustomers.map((customer) => ({
          name: `${customer.first_name} ${customer.last_name}`,
          companyName: customer.company_name,
          email: customer.email,
          invoiceCount: parseInt(customer.invoice_count),
          totalSales: parseFloat(customer.total_sales),
          avgOrderValue: parseFloat(customer.avg_order_value),
        })),
      },
      details: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  private async generateProductPerformanceReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // Top productos vendidos
    const topProducts = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.items', 'items')
      .leftJoin('items.product', 'product')
      .select([
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
      .limit(20)
      .getRawMany();

    return {
      title: query.title || 'Rendimiento de Productos',
      description:
        query.description ||
        `Análisis de rendimiento de productos del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        topProducts: topProducts.map((product) => ({
          name: product.product_name,
          sku: product.sku,
          quantitySold: parseFloat(product.quantity_sold),
          totalRevenue: parseFloat(product.total_revenue),
        })),
      },
      details: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  private async generateCashFlowReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // Cuentas por cobrar
    const accountsReceivable = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.balanceDue)', 'total_receivable')
      .where('invoice.status IN (:...statuses)', {
        statuses: ['pending', 'partially_paid'],
      })
      .getRawOne();

    // Facturas vencidas
    const overdueInvoices = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.customer', 'customer')
      .select([
        'invoice.number as invoice_number',
        'customer.firstName as first_name',
        'customer.lastName as last_name',
        'invoice.total as total',
        'invoice.balanceDue as balance_due',
        'invoice.dueDate as due_date',
      ])
      .where('invoice.dueDate < :today', { today: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['pending', 'partially_paid'],
      })
      .orderBy('invoice.dueDate', 'ASC')
      .getRawMany();

    return {
      title: query.title || 'Reporte de Flujo de Caja',
      description:
        query.description ||
        `Análisis de flujo de caja del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        totalReceivable: parseFloat(accountsReceivable.total_receivable) || 0,
        overdueInvoices: overdueInvoices.map((invoice) => ({
          invoiceNumber: invoice.invoice_number,
          customerName: `${invoice.first_name} ${invoice.last_name}`,
          total: parseFloat(invoice.total),
          balanceDue: parseFloat(invoice.balance_due),
          dueDate: invoice.due_date,
        })),
      },
      details: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  private async generateTaxReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // IVA cobrado en ventas
    const taxCollected = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'SUM(invoice.taxAmount) as total_tax_collected',
        'SUM(invoice.subtotal) as total_subtotal',
        'COUNT(invoice.id) as invoice_count',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['paid', 'partially_paid'],
      })
      .getRawOne();

    return {
      title: query.title || 'Reporte de Impuestos',
      description:
        query.description ||
        `Reporte de impuestos del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        totalTaxCollected: parseFloat(taxCollected.total_tax_collected) || 0,
        totalSubtotal: parseFloat(taxCollected.total_subtotal) || 0,
        invoiceCount: parseInt(taxCollected.invoice_count) || 0,
        effectiveTaxRate:
          parseFloat(taxCollected.total_subtotal) > 0
            ? (parseFloat(taxCollected.total_tax_collected) /
                parseFloat(taxCollected.total_subtotal)) *
              100
            : 0,
      },
      details: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  private async generateInventoryReport(
    startDate: Date,
    endDate: Date,
    query: ReportQueryDto,
    userId: string,
  ): Promise<ReportData> {
    // Resumen de inventario
    const inventorySummary = await this.productRepository
      .createQueryBuilder('product')
      .select([
        'COUNT(product.id) as total_products',
        'SUM(product.stock) as total_stock',
      ])
      .where('product.status = :status', { status: 'active' })
      .getRawOne();

    // Productos con stock bajo
    const lowStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.category', 'category')
      .select([
        'product.name as product_name',
        'product.sku as sku',
        'product.stock as current_stock',
        'product.minStock as min_stock',
        'category.name as category_name',
      ])
      .where('product.stock <= product.minStock')
      .andWhere('product.status = :status', { status: 'active' })
      .orderBy('product.stock', 'ASC')
      .getRawMany();

    return {
      title: query.title || 'Reporte de Inventario',
      description:
        query.description ||
        `Estado del inventario al ${endDate.toLocaleDateString()}`,
      period: { startDate, endDate },
      summary: {
        totalProducts: parseInt(inventorySummary.total_products) || 0,
        totalStock: parseFloat(inventorySummary.total_stock) || 0,
        lowStockProducts: lowStockProducts.map((product) => ({
          productName: product.product_name,
          sku: product.sku,
          currentStock: parseFloat(product.current_stock),
          minStock: parseFloat(product.min_stock),
          categoryName: product.category_name,
        })),
      },
      details: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        format: query.format || 'json',
      },
    };
  }

  // Métodos auxiliares
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

  private async getSalesDetails(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.customer', 'customer')
      .select([
        'invoice.number as invoice_number',
        'invoice.date as date',
        'invoice.total as total',
        'invoice.status as status',
        'customer.firstName as customer_first_name',
        'customer.lastName as customer_last_name',
      ])
      .where('invoice.date >= :startDate', { startDate })
      .andWhere('invoice.date <= :endDate', { endDate })
      .orderBy('invoice.date', 'DESC')
      .getRawMany();
  }

  private async getExpenseDetails(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .select([
        'expense.description as description',
        'expense.amount as amount',
        'expense.date as date',
        'expense.status as status',
        'category.name as category_name',
      ])
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .orderBy('expense.date', 'DESC')
      .getRawMany();
  }
}
