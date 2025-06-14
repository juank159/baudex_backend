// src/modules/dashboard/interfaces/dashboard.interfaces.ts
import { DashboardPeriod } from '../dto/dashboard-query.dto';

export interface DashboardSummary {
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  period: {
    startDate: Date;
    endDate: Date;
    type: DashboardPeriod;
  };
}

export interface SalesChart {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
}

export interface CategorySales {
  categoryName: string;
  categoryId: string;
  totalSales: number;
  productCount: number;
  percentage: number;
  color?: string;
}

export interface TopProducts {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  totalRevenue: number;
  profitMargin: number;
}

export interface TopCustomers {
  customerId: string;
  customerName: string;
  companyName?: string;
  totalPurchases: number;
  invoiceCount: number;
  lastPurchase: Date;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ExpensesBreakdown {
  categoryName: string;
  categoryId: string;
  totalAmount: number;
  percentage: number;
  budgetUsed: number;
  color?: string;
}

export interface CashFlowData {
  date: string;
  income: number;
  expenses: number;
  netFlow: number;
  cumulativeFlow: number;
}

export interface PaymentMethodStats {
  method: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface FinancialKPIs {
  // Ventas
  totalRevenue: number;
  averageOrderValue: number;
  conversionRate: number;

  // Gastos
  totalExpenses: number;
  expenseRatio: number;

  // Rentabilidad
  grossProfit: number;
  grossProfitMargin: number;
  netProfit: number;
  netProfitMargin: number;

  // Clientes
  customerAcquisitionCost: number;
  customerLifetimeValue: number;
  customerRetentionRate: number;

  // Inventario
  inventoryTurnover: number;
  daysInInventory: number;

  // Liquidez
  accountsReceivable: number;
  averageCollectionPeriod: number;
}
