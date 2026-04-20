/**
 * Contrato del endpoint GET /dashboard/summary.
 * Incluido en clients offline (Flutter) para asegurar paridad de estructura.
 */

export interface DashboardDateRange {
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface CurrencyBreakdown {
  currency: string;
  count: number;
  totalBaseAmount: number;
  totalForeignAmount: number;
  avgRate: number;
  percentage: number;
}

export interface IncomeTypeBreakdown {
  // Total combinado (newInvoices + paymentsOnOldInvoices). Se mantiene por compat.
  invoices: number;
  // Total facturado en el período (accrual basis).
  newInvoices: number;
  // Abonos recibidos en el período sobre facturas creadas fuera del período.
  paymentsOnOldInvoices: number;
  // Saldos a favor de clientes aplicados a facturas nuevas del período.
  credits: number;
  total: number;
}

export interface ReceivablesBucket {
  count: number;
  total: number;
  maxDaysOverdue: number;
}

export interface TopDebtor {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  totalBalance: number;
  maxDaysOverdue: number;
}

export interface Receivables {
  total: number;
  count: number;
  byUrgency: {
    current: ReceivablesBucket;
    dueSoon: ReceivablesBucket;
    overdue: ReceivablesBucket;
  };
  topDebtors: TopDebtor[];
}

export interface TrendPoint {
  date: string;        // YYYY-MM-DD
  revenue: number;     // Dinero realmente cobrado ese día
  billed: number;      // Total facturado ese día (incluye crédito)
  expenses: number;
}

export interface DashboardSummaryResponse {
  // Cobrado en caja (cash basis) — la métrica principal para el usuario.
  totalCollected: number;
  // Facturado total (accrual basis) — incluye ventas a crédito no cobradas.
  totalBilled: number;
  totalRevenue: number; // alias de totalBilled para compat
  totalExpenses: number;
  totalCOGS: number;
  grossProfit: number;           // totalCollected - totalCOGS
  netProfit: number;             // grossProfit - totalExpenses
  grossMarginPercentage: number; // sobre totalCollected, 1 decimal
  netMarginPercentage: number;   // sobre totalCollected, 1 decimal

  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  totalCustomers: number;
  totalProducts: number;
  revenueGrowth: number; // % vs período anterior (de totalCollected)

  paymentMethodsBreakdown: PaymentMethodBreakdown[];
  currencyBreakdown: CurrencyBreakdown[] | null;
  incomeTypeBreakdown: IncomeTypeBreakdown;
  receivables: Receivables;

  baseCurrency: string;
  multiCurrencyEnabled: boolean;

  // Datos reales (no fabricados) para gráfica de tendencia.
  trend: TrendPoint[];
}
