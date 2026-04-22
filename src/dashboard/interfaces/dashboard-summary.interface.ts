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

/**
 * Resumen de caja (flujo de efectivo del período).
 * Separa los 3 orígenes de "dinero que entró" para reportar con criterio contable:
 *  - `salesCollected` → ingreso por ventas (cobros de factura)
 *  - `loanPayments`   → recuperación de cartera (abonos a préstamos directos)
 *  - `customerDeposits` → anticipos (pasivo: lo debes al cliente hasta que se use)
 * El total es la caja real del período. Mostrar sumado puede inflar ventas,
 * por eso se entrega desagregado.
 */
/** Fila de desglose por cuenta bancaria o método de pago. */
export interface CashFlowMethodRow {
  method: string;   // Nombre de cuenta (Nequi, Daviplata…) o método crudo (cash…) o 'Sin especificar'
  count: number;
  total: number;
}

export interface CashFlowSummary {
  salesCollected: number;
  salesCollectedCount: number;
  loanPayments: number;
  loanPaymentsCount: number;
  customerDeposits: number;
  customerDepositsCount: number;
  totalCashIn: number;

  // Desgloses por cuenta/método para responder "¿dónde entró esa plata?".
  loanPaymentsBreakdown: CashFlowMethodRow[];
  customerDepositsBreakdown: CashFlowMethodRow[];
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

  // Flujo de caja: ventas + préstamos + anticipos, desagregados.
  cashFlow: CashFlowSummary;

  // Compras del período agrupadas por moneda (null = organizaciones sin
  // multi-moneda habilitada, para evitar queries innecesarias).
  purchaseCurrencyBreakdown: CurrencyBreakdown[] | null;

  // ─── Campos legacy (DEPRECATED — serán removidos en versión siguiente) ───
  /** @deprecated usar grossProfit/netProfit. Aquí solo como totalRevenue-totalExpenses. */
  totalProfit: number;
  /** @deprecated usar grossMarginPercentage (con COGS). Aquí como string p/ compat. */
  profitMargin: string;
  /** @deprecated usar receivables.total */
  accountsReceivable: number;
  /** @deprecated usar receivables.count */
  receivableCount: number;
  /** @deprecated usar trend */
  monthlyStats: {
    currentMonth: { revenue: number; expenses: number; profit: number; invoicesCount: number };
    previousMonth: { revenue: number; expenses: number; profit: number; invoicesCount: number };
  };
  /** @deprecated usar trend */
  chartData: { revenue: number[]; expenses: number[]; profit: number[] };
}
