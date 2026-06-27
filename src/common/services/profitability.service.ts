import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale, SaleStatus } from '../../sales/entities/sale.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';
import { Invoice, InvoiceStatus } from '../../invoices/entities/invoice.entity';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity';

interface ProfitabilityStats {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMarginPercentage: number;
  netProfit: number;
  netMarginPercentage: number;
  averageMarginPerSale: number;
  topProfitableProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    categoryName: string;
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    marginPercentage: number;
    unitsSold: number;
    averageSellingPrice: number;
    averageFifoCost: number;
  }>;
  lowProfitableProducts: Array<any>;
  marginsByCategory: Record<string, number>;
  trend: {
    previousPeriodGrossMargin: number;
    currentPeriodGrossMargin: number;
    marginGrowth: number;
    isImproving: boolean;
    dailyMargins: Array<{
      date: string;
      grossMarginPercentage: number;
      dailyRevenue: number;
      dailyCOGS: number;
    }>;
  };
}

@Injectable()
export class ProfitabilityService {
  private readonly logger = new Logger(ProfitabilityService.name);

  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
  ) {}

  async getProfitabilityStats(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ProfitabilityStats> {

    // 📅 Modelo ACCRUAL: incluir todas las facturas EMITIDAS (no draft/cancelled/credited).
    // La rentabilidad se mide sobre lo vendido, no solo sobre lo cobrado.
    // Ventas a crédito (pending/overdue) también generaron costo de mercancía y
    // representan ingresos futuros comprometidos — excluirlas distorsiona el margen real.
    const qb = this.invoiceRepository.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.status NOT IN (:...excluded)', {
        excluded: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.CREDITED],
      })
      .andWhere('invoice.deletedAt IS NULL');

    if (startDate && endDate) {
      qb.andWhere('invoice.date >= CAST(:startDate AS date) AND invoice.date <= CAST(:endDate AS date)', {
        startDate,
        endDate,
      });

    } else if (startDate) {
      qb.andWhere('invoice.date >= CAST(:startDate AS date)', { startDate });

    } else if (endDate) {
      qb.andWhere('invoice.date <= CAST(:endDate AS date)', { endDate });

    } else {

    }

    const invoices = await qb.getMany();

    let totalRevenue = 0;
    let totalCOGS = 0;
    const productStats = new Map();
    const categoryStats = new Map();

    // Modelo ACCRUAL: usar el valor FACTURADO completo (precio × cantidad).
    // No aplicar paymentRatio — la venta está comprometida por el total de la factura
    // independientemente de cuánto se haya cobrado hasta ahora.
    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const revenue = parseFloat(String(item.unitPrice ?? 0)) * (item.quantity ?? 0);
        const cost    = parseFloat(String((item as any).totalCost ?? 0));

        totalRevenue += revenue;
        totalCOGS    += cost;

        // Estadísticas por producto
        const productId = item.productId || `unknown_${Date.now()}_${Math.random()}`;
        if (!productStats.has(productId)) {
          productStats.set(productId, {
            productId,
            productName: item.product?.name || 'Producto desconocido',
            sku: item.product?.sku || '',
            categoryName: (item.product as any)?.category?.name || 'General',
            totalRevenue: 0,
            totalCOGS: 0,
            unitsSold: 0,
          });
        }

        const productStat = productStats.get(productId);
        productStat.totalRevenue += revenue;
        productStat.totalCOGS    += cost;
        productStat.unitsSold    += item.quantity ?? 0;

        // Estadísticas por categoría
        const categoryName = (item.product as any)?.category?.name || 'General';
        if (!categoryStats.has(categoryName)) {
          categoryStats.set(categoryName, { totalRevenue: 0, totalCOGS: 0 });
        }

        const categoryStat = categoryStats.get(categoryName);
        categoryStat.totalRevenue += revenue;
        categoryStat.totalCOGS    += cost;
      }
    }

    // Diagnóstico: registrar cuando hay pérdidas para ayudar a identificar la causa
    if (totalCOGS > totalRevenue && invoices.length > 0) {
      this.logger.warn(
        `[PROFITABILITY-LOSS] org=${organizationId} range=${startDate}→${endDate} ` +
        `revenue=${totalRevenue.toFixed(2)} COGS=${totalCOGS.toFixed(2)} ` +
        `invoices=${invoices.length}`,
      );
      // Listar las facturas con margen negativo (top 5 peores)
      const lossItems: Array<{invoiceId: string; status: string; revenue: number; cogs: number}> = [];
      for (const invoice of invoices) {
        let invRevenue = 0, invCogs = 0;
        for (const item of invoice.items) {
          invRevenue += parseFloat(String(item.unitPrice ?? 0)) * (item.quantity ?? 0);
          invCogs    += parseFloat(String((item as any).totalCost ?? 0));
        }
        if (invCogs > invRevenue) {
          lossItems.push({ invoiceId: invoice.id, status: invoice.status, revenue: invRevenue, cogs: invCogs });
        }
      }
      lossItems.sort((a, b) => (a.revenue - a.cogs) - (b.revenue - b.cogs));
      for (const li of lossItems.slice(0, 5)) {
        this.logger.warn(
          `  ↳ invoice=${li.invoiceId} status=${li.status} revenue=${li.revenue.toFixed(2)} COGS=${li.cogs.toFixed(2)} loss=${(li.cogs - li.revenue).toFixed(2)}`,
        );
      }
    }

    // Calcular métricas principales
    const grossProfit = totalRevenue - totalCOGS;
    const grossMarginPercentage = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Procesar productos más rentables
    const topProfitableProducts = Array.from(productStats.values())
      .map((product: any) => {
        const grossProfit = product.totalRevenue - product.totalCOGS;
        const marginPercentage = product.totalRevenue > 0
          ? (grossProfit / product.totalRevenue) * 100
          : 0;

        return {
          ...product,
          grossProfit,
          marginPercentage,
          averageSellingPrice: product.unitsSold > 0
            ? product.totalRevenue / product.unitsSold
            : 0,
          averageFifoCost: product.unitsSold > 0
            ? product.totalCOGS / product.unitsSold
            : 0,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 10);

    // Procesar márgenes por categoría
    const marginsByCategory: Record<string, number> = {};
    for (const [categoryName, stats] of categoryStats.entries()) {
      const categoryProfit = (stats as any).totalRevenue - (stats as any).totalCOGS;
      marginsByCategory[categoryName] = (stats as any).totalRevenue > 0
        ? (categoryProfit / (stats as any).totalRevenue) * 100
        : 0;
    }

    // Consultar gastos aprobados/pagados del período para calcular netProfit real
    let totalExpenses = 0;
    try {
      const expensesParams: any[] = [organizationId];
      let expensesDateFilter = '';
      if (startDate && endDate) {
        expensesDateFilter = ' AND date >= $2::date AND date <= $3::date';
        expensesParams.push(startDate, endDate);
      } else if (startDate) {
        expensesDateFilter = ' AND date >= $2::date';
        expensesParams.push(startDate);
      } else if (endDate) {
        expensesDateFilter = ' AND date <= $2::date';
        expensesParams.push(endDate);
      }
      const expensesResult = await this.invoiceRepository.manager.query(`
        SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
        FROM expenses
        WHERE organization_id = $1
        AND status IN ('approved', 'paid')
        AND deleted_at IS NULL
        ${expensesDateFilter}
      `, expensesParams);
      totalExpenses = parseFloat(expensesResult[0]?.total || '0');
    } catch (e) {

    }

    const netProfit = grossProfit - totalExpenses;
    const netMarginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      grossMarginPercentage,
      netProfit,
      netMarginPercentage,
      averageMarginPerSale: invoices.length > 0 ? grossMarginPercentage : 0,
      topProfitableProducts,
      lowProfitableProducts: [],
      marginsByCategory,
      trend: {
        previousPeriodGrossMargin: 0,
        currentPeriodGrossMargin: grossMarginPercentage,
        marginGrowth: 0,
        isImproving: grossMarginPercentage > 0,
        dailyMargins: [
          {
            date: endDate || new Date().toISOString().split('T')[0],
            grossMarginPercentage,
            dailyRevenue: totalRevenue,
            dailyCOGS: totalCOGS,
          },
        ],
      },
    };
  }
}
