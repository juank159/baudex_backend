import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ProfitabilityService } from '../../common/services/profitability.service';
import { DashboardQueryBuilder } from './dashboard-query.builder';
import {
  CashFlowMethodRow,
  CashFlowSummary,
  DashboardSummaryResponse,
  IncomeTypeBreakdown,
  PaymentMethodBreakdown,
  Receivables,
  ReceivablesBucket,
  TopDebtor,
  TrendPoint,
} from '../interfaces/dashboard-summary.interface';

interface OrgContext {
  timezone: string;
  baseCurrency: string;
  multiCurrencyEnabled: boolean;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly profitability: ProfitabilityService,
    @InjectEntityManager() private readonly em: EntityManager,
  ) {}

  async getSummary(
    organizationId: string,
    startDateStr: string,
    endDateStr: string,
  ): Promise<DashboardSummaryResponse> {
    if (!organizationId) throw new BadRequestException('Organization ID required');

    const org = await this.getOrgContext(organizationId);
    const startUtc = DashboardQueryBuilder.toUtcRange(startDateStr, org.timezone);
    const endUtcExclusive = this.addOneDay(DashboardQueryBuilder.toUtcRange(endDateStr, org.timezone));

    // Todas las sub-queries paralelas. Cada una usa índice: queries < 5ms c/u en prod.
    const [
      invoiceAgg,
      expenseAgg,
      productAgg,
      customerAgg,
      collectedAgg,
      oldInvoicesAgg,
      methodsRows,
      currencyRows,
      creditsAgg,
      creditNotesAgg,
      receivablesRows,
      debtorsRows,
      trendRows,
      profitability,
      previousRevenue,
      loanPaymentsAgg,
      depositsAgg,
      loanPaymentsByMethodRows,
      depositsByMethodRows,
      purchaseCurrencyRows,
    ] = await Promise.all([
      this.q(DashboardQueryBuilder.invoiceAggregates(), [organizationId, startDateStr, endDateStr]),
      this.q(DashboardQueryBuilder.expenseAggregate(), [organizationId, startDateStr, endDateStr]),
      this.q(DashboardQueryBuilder.productCount(), [organizationId]),
      this.q(DashboardQueryBuilder.customerCount(), [organizationId]),
      this.q(DashboardQueryBuilder.totalCollected(), [organizationId, startUtc, endUtcExclusive]),
      this.q(DashboardQueryBuilder.paymentsOnOldInvoices(), [
        organizationId, startUtc, endUtcExclusive, startDateStr, endDateStr,
      ]),
      this.q(DashboardQueryBuilder.paymentMethodsBreakdown(), [
        organizationId, startUtc, endUtcExclusive, startDateStr, endDateStr,
      ]),
      org.multiCurrencyEnabled
        ? this.q(DashboardQueryBuilder.currencyBreakdown(), [
            organizationId, org.baseCurrency, startUtc, endUtcExclusive, startDateStr, endDateStr,
          ])
        : Promise.resolve([] as any[]),
      this.q(DashboardQueryBuilder.creditsApplied(), [organizationId, startDateStr, endDateStr]),
      this.q(DashboardQueryBuilder.creditNotesApplied(), [
        organizationId, startDateStr, endDateStr, org.timezone,
      ]),
      this.q(DashboardQueryBuilder.receivablesByUrgency(), [organizationId, org.timezone]),
      this.q(DashboardQueryBuilder.topDebtors(), [organizationId, org.timezone]),
      this.q(DashboardQueryBuilder.trendByDay(), [
        organizationId, startDateStr, endDateStr, org.timezone, startUtc, endUtcExclusive,
      ]),
      this.profitability.getProfitabilityStats(organizationId, startDateStr, endDateStr).catch(() => null),
      this.getPreviousRevenue(organizationId, org.timezone, startDateStr, endDateStr),
      this.q(DashboardQueryBuilder.directLoanPayments(), [organizationId, startUtc, endUtcExclusive]),
      this.q(DashboardQueryBuilder.customerDeposits(), [organizationId, startUtc, endUtcExclusive]),
      this.q(DashboardQueryBuilder.directLoanPaymentsByMethod(), [organizationId, startUtc, endUtcExclusive]),
      this.q(DashboardQueryBuilder.customerDepositsByMethod(), [organizationId, startUtc, endUtcExclusive]),
      org.multiCurrencyEnabled
        ? this.q(DashboardQueryBuilder.purchaseCurrencyBreakdown(), [
            organizationId, org.baseCurrency, startUtc, endUtcExclusive,
          ])
        : Promise.resolve([] as any[]),
    ]);

    // Parseo y composición del response
    const totalBilled = num(invoiceAgg[0]?.total_billed);
    const totalCollected = num(collectedAgg[0]?.total_collected);
    const totalExpenses = num(expenseAgg[0]?.total_amount);
    const totalCOGS = num((profitability as any)?.totalCOGS);
    const creditsIncome = num(creditsAgg[0]?.total);
    const paymentsOnOld = num(oldInvoicesAgg[0]?.payment_income);

    // Notas de crédito aplicadas en el período: representan dinero que
    // SE DEVUELVE o se convierte en saldo a favor del cliente. Reducen
    // el ingreso real de la venta original.
    const creditNotesTotal = num(creditNotesAgg[0]?.total);
    const creditNotesCount = Number(creditNotesAgg[0]?.count ?? 0);

    // Ingreso neto = lo cobrado - lo devuelto vía notas de crédito.
    // Es el dinero que efectivamente se quedó el negocio en el período.
    const netRevenue = totalCollected - creditNotesTotal;

    // grossProfit y márgenes ahora se calculan sobre el NETO, no sobre
    // el bruto cobrado. Esto refleja la rentabilidad real: si vendí
    // $1M pero devolví $200k, mi base efectiva es $800k.
    const grossProfit = netRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
    const revenueGrowth = previousRevenue > 0
      ? ((totalCollected - previousRevenue) / previousRevenue) * 100
      : 0;

    const totalMethodsAmount = methodsRows.reduce((s, r) => s + num(r.total_amount), 0);
    const paymentMethodsBreakdown: PaymentMethodBreakdown[] = methodsRows.map(r => ({
      method: r.method || 'Sin especificar',
      count: Number(r.count ?? 0),
      totalAmount: num(r.total_amount),
      percentage: totalMethodsAmount > 0 ? (num(r.total_amount) / totalMethodsAmount) * 100 : 0,
    }));

    const totalCurrencyBase = currencyRows.reduce((s, r) => s + num(r.total_base_amount), 0);
    const currencyBreakdown = org.multiCurrencyEnabled
      ? currencyRows.map(r => ({
          currency: r.currency,
          count: Number(r.count ?? 0),
          totalBaseAmount: num(r.total_base_amount),
          totalForeignAmount: num(r.total_foreign_amount),
          avgRate: num(r.avg_rate) || 1,
          percentage: totalCurrencyBase > 0 ? (num(r.total_base_amount) / totalCurrencyBase) * 100 : 0,
        }))
      : null;

    // Desglose de COMPRAS por moneda (misma estructura que pagos).
    const totalPurchaseBase = purchaseCurrencyRows.reduce(
      (s, r) => s + num(r.total_base_amount),
      0,
    );
    const purchaseCurrencyBreakdown = org.multiCurrencyEnabled
      ? purchaseCurrencyRows.map(r => ({
          currency: r.currency,
          count: Number(r.count ?? 0),
          totalBaseAmount: num(r.total_base_amount),
          totalForeignAmount: num(r.total_foreign_amount),
          avgRate: num(r.avg_rate) || 1,
          percentage:
            totalPurchaseBase > 0 ? (num(r.total_base_amount) / totalPurchaseBase) * 100 : 0,
        }))
      : null;

    const incomeTypeBreakdown: IncomeTypeBreakdown = this.buildIncomeTypeBreakdown(
      totalBilled, paymentsOnOld, creditsIncome,
    );

    const receivables = this.buildReceivables(receivablesRows, debtorsRows);

    const trend: TrendPoint[] = trendRows.map(r => ({
      date: r.date,
      revenue: num(r.revenue),
      billed: num(r.billed),
      expenses: num(r.expenses),
    }));

    const loanPayments = num(loanPaymentsAgg[0]?.total);
    const loanPaymentsCount = Number(loanPaymentsAgg[0]?.count ?? 0);
    const customerDeposits = num(depositsAgg[0]?.total);
    const customerDepositsCount = Number(depositsAgg[0]?.count ?? 0);
    const salesCount = Number(collectedAgg[0]?.payment_count ?? 0);

    const toMethodRow = (r: any): CashFlowMethodRow => ({
      method: r.method || 'Sin especificar',
      count: Number(r.count ?? 0),
      total: num(r.total),
    });

    const cashFlow: CashFlowSummary = {
      salesCollected: totalCollected,
      salesCollectedCount: salesCount,
      loanPayments,
      loanPaymentsCount,
      customerDeposits,
      customerDepositsCount,
      totalCashIn: totalCollected + loanPayments + customerDeposits,
      loanPaymentsBreakdown: loanPaymentsByMethodRows.map(toMethodRow),
      customerDepositsBreakdown: depositsByMethodRows.map(toMethodRow),
    };

    // ─── Shims legacy para no romper clientes que aún no se actualizan ───
    const totalRevenueLegacy = totalBilled + paymentsOnOld;
    const totalProfitLegacy = totalRevenueLegacy - totalExpenses;
    const profitMarginLegacy = totalRevenueLegacy > 0
      ? round1((totalProfitLegacy / totalRevenueLegacy) * 100).toFixed(1)
      : '0';
    const monthlyStats = {
      currentMonth: {
        revenue: totalRevenueLegacy,
        expenses: totalExpenses,
        profit: totalProfitLegacy,
        invoicesCount: Number(invoiceAgg[0]?.total_invoices ?? 0),
      },
      previousMonth: {
        revenue: previousRevenue,
        expenses: 0,
        profit: previousRevenue,
        invoicesCount: 0,
      },
    };
    // chartData queda como array vacío — frontend debe migrar a `trend`.
    const chartData = { revenue: [], expenses: [], profit: [] };

    return {
      totalCollected,
      totalBilled: totalRevenueLegacy,
      totalRevenue: totalRevenueLegacy,
      totalExpenses,
      totalCOGS,
      // Phase 1B: Net revenue (bruto cobrado - notas de crédito aplicadas)
      // y desglose para que el dashboard muestre ambos.
      creditNotesTotal,
      creditNotesCount,
      netRevenue,
      grossProfit,
      netProfit,
      grossMarginPercentage: round1(grossMargin),
      netMarginPercentage: round1(netMargin),

      totalInvoices: Number(invoiceAgg[0]?.total_invoices ?? 0),
      paidInvoices: Number(invoiceAgg[0]?.paid_invoices ?? 0),
      pendingInvoices: Number(invoiceAgg[0]?.pending_invoices ?? 0),
      totalCustomers: Number(customerAgg[0]?.total ?? 0),
      totalProducts: Number(productAgg[0]?.total ?? 0),
      revenueGrowth: round1(revenueGrowth),

      paymentMethodsBreakdown,
      currencyBreakdown,
      purchaseCurrencyBreakdown,
      incomeTypeBreakdown,
      receivables,

      baseCurrency: org.baseCurrency,
      multiCurrencyEnabled: org.multiCurrencyEnabled,

      trend,
      cashFlow,

      // Legacy shims
      totalProfit: totalProfitLegacy,
      profitMargin: profitMarginLegacy,
      accountsReceivable: receivables.total,
      receivableCount: receivables.count,
      monthlyStats,
      chartData,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async getOrgContext(organizationId: string): Promise<OrgContext> {
    const [row] = await this.em.query(
      'SELECT timezone, currency, "multiCurrencyEnabled" FROM organizations WHERE id = $1',
      [organizationId],
    );
    return {
      timezone: row?.timezone || 'America/New_York',
      baseCurrency: row?.currency || 'COP',
      multiCurrencyEnabled: Boolean(row?.multiCurrencyEnabled),
    };
  }

  private async q(sql: string, params: any[]): Promise<any[]> {
    return this.em.query(sql, params);
  }

  private addOneDay(d: Date): Date {
    return new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }

  private async getPreviousRevenue(
    orgId: string,
    orgTz: string,
    startStr: string,
    endStr: string,
  ): Promise<number> {
    const start = new Date(`${startStr}T00:00:00`);
    const end = new Date(`${endStr}T00:00:00`);
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - diffDays);

    const prevStartStr = prevStart.toISOString().slice(0, 10);
    const prevEndStr = prevEnd.toISOString().slice(0, 10);

    const prevStartUtc = DashboardQueryBuilder.toUtcRange(prevStartStr, orgTz);
    const prevEndUtcExcl = this.addOneDay(DashboardQueryBuilder.toUtcRange(prevEndStr, orgTz));

    const rows = await this.q(DashboardQueryBuilder.previousPeriodRevenue(), [
      orgId, prevStartUtc, prevEndUtcExcl,
    ]);
    return num(rows[0]?.total);
  }

  private buildIncomeTypeBreakdown(
    billedInPeriod: number,
    paymentsOnOld: number,
    credits: number,
  ): IncomeTypeBreakdown {
    const invoices = billedInPeriod + paymentsOnOld;
    return {
      invoices,
      newInvoices: billedInPeriod,
      paymentsOnOldInvoices: paymentsOnOld,
      credits,
      total: invoices + credits,
    };
  }

  private buildReceivables(urgencyRows: any[], debtorRows: any[]): Receivables {
    const empty = (): ReceivablesBucket => ({ count: 0, total: 0, maxDaysOverdue: 0 });
    const byUrgency = { current: empty(), dueSoon: empty(), overdue: empty() };

    for (const row of urgencyRows) {
      const bucket = byUrgency[row.urgency as keyof typeof byUrgency];
      if (bucket) {
        bucket.count = Number(row.count ?? 0);
        bucket.total = num(row.total);
        bucket.maxDaysOverdue = Number(row.max_days_overdue ?? 0);
      }
    }

    const topDebtors: TopDebtor[] = debtorRows.map(r => ({
      customerId: r.customer_id,
      customerName: r.customer_name,
      invoiceCount: Number(r.invoice_count ?? 0),
      totalBalance: num(r.total_balance),
      maxDaysOverdue: Number(r.max_days_overdue ?? 0),
    }));

    return {
      total: byUrgency.current.total + byUrgency.dueSoon.total + byUrgency.overdue.total,
      count: byUrgency.current.count + byUrgency.dueSoon.count + byUrgency.overdue.count,
      byUrgency,
      topDebtors,
    };
  }
}

// ─── Util ─────────────────────────────────────────────────────
const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (n: number): number => Math.round(n * 10) / 10;
