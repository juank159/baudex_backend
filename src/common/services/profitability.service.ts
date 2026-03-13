import { Injectable } from '@nestjs/common';
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
    console.log('🎯 CALCULANDO RENTABILIDAD FIFO CON FACTURAS REALES');
    console.log(`📅 Filtros de fecha - Inicio: ${startDate || 'Sin filtro'}, Fin: ${endDate || 'Sin filtro'}`);

    // 📅 USAR QUERYBUILDER CON CAST EXPLÍCITO ::date PARA COMPARACIONES CORRECTAS
    const qb = this.invoiceRepository.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
      })
      .andWhere('invoice.deletedAt IS NULL');

    if (startDate && endDate) {
      qb.andWhere('invoice.date >= CAST(:startDate AS date) AND invoice.date <= CAST(:endDate AS date)', {
        startDate,
        endDate,
      });
      console.log(`📅 Aplicando filtro de fechas: ${startDate} - ${endDate}`);
    } else if (startDate) {
      qb.andWhere('invoice.date >= CAST(:startDate AS date)', { startDate });
      console.log(`📅 Aplicando filtro desde: ${startDate}`);
    } else if (endDate) {
      qb.andWhere('invoice.date <= CAST(:endDate AS date)', { endDate });
      console.log(`📅 Aplicando filtro hasta: ${endDate}`);
    } else {
      console.log(`📅 Sin filtro de fechas - incluyendo todas las facturas`);
    }

    const invoices = await qb.getMany();

    console.log(`📊 Encontradas ${invoices.length} facturas pagadas con FIFO real`);

    let totalRevenue = 0;
    let totalCOGS = 0;
    const productStats = new Map();
    const categoryStats = new Map();

    // Procesar cada factura con costos FIFO reales
    for (const invoice of invoices) {
      for (const item of invoice.items) {
        // Usar el total de la factura y los costos FIFO calculados
        const revenue = item.unitPrice * item.quantity; // Precio de venta total
        const cost = item.totalCost || 0; // Costo FIFO calculado
        const profit = revenue - cost;

        totalRevenue += revenue;
        totalCOGS += cost;

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
        productStat.totalCOGS += cost;
        productStat.unitsSold += item.quantity;

        // Estadísticas por categoría
        const categoryName = (item.product as any)?.category?.name || 'General';
        if (!categoryStats.has(categoryName)) {
          categoryStats.set(categoryName, {
            totalRevenue: 0,
            totalCOGS: 0,
          });
        }

        const categoryStat = categoryStats.get(categoryName);
        categoryStat.totalRevenue += revenue;
        categoryStat.totalCOGS += cost;
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
      console.log('⚠️ Error consultando gastos para netProfit:', e);
    }

    const netProfit = grossProfit - totalExpenses;
    const netMarginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    console.log('💰 DATOS REALES FIFO CALCULADOS DESDE FACTURAS:');
    console.log(`   📦 Ingresos: $${totalRevenue.toLocaleString()}`);
    console.log(`   💸 Costos FIFO: $${totalCOGS.toLocaleString()}`);
    console.log(`   📈 Ganancia Bruta: $${grossProfit.toLocaleString()}`);
    console.log(`   💰 Gastos: $${totalExpenses.toLocaleString()}`);
    console.log(`   📊 Ganancia Neta: $${netProfit.toLocaleString()}`);
    console.log(`   📊 Margen FIFO: ${grossMarginPercentage.toFixed(2)}%`);

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
