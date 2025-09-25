import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProfitabilityStats> {
    console.log('🎯 CALCULANDO RENTABILIDAD FIFO CON FACTURAS REALES');
    console.log(`📅 Filtros de fecha - Inicio: ${startDate?.toISOString() || 'Sin filtro'}, Fin: ${endDate?.toISOString() || 'Sin filtro'}`);
    
    // 📅 CONSTRUIR FILTROS DE FECHA DINÁMICAMENTE
    const whereConditions: any = {
      organizationId,
      status: InvoiceStatus.PAID, // Solo facturas pagadas
      deletedAt: null,
    };

    // Solo aplicar filtro de fecha si se proporciona
    if (startDate && endDate) {
      whereConditions.date = Between(startDate, endDate);
      console.log(`📅 Aplicando filtro de fechas: ${startDate.toISOString()} - ${endDate.toISOString()}`);
    } else if (startDate) {
      // Solo fecha de inicio
      whereConditions.date = Between(startDate, new Date());
      console.log(`📅 Aplicando filtro desde: ${startDate.toISOString()}`);
    } else if (endDate) {
      // Solo fecha de fin
      whereConditions.date = Between(new Date('2000-01-01'), endDate);
      console.log(`📅 Aplicando filtro hasta: ${endDate.toISOString()}`);
    } else {
      console.log(`📅 Sin filtro de fechas - incluyendo todas las facturas`);
    }

    // CAMBIO CRÍTICO: Usar facturas en lugar de ventas para FIFO real
    const invoices = await this.invoiceRepository.find({
      where: whereConditions,
      relations: ['items', 'items.product', 'items.product.category'],
    });

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

    console.log('💰 DATOS REALES FIFO CALCULADOS DESDE FACTURAS:');
    console.log(`   📦 Ingresos: $${totalRevenue.toLocaleString()}`);
    console.log(`   💸 Costos FIFO: $${totalCOGS.toLocaleString()}`);
    console.log(`   📈 Ganancia FIFO: $${grossProfit.toLocaleString()}`);
    console.log(`   📊 Margen FIFO: ${grossMarginPercentage.toFixed(2)}%`);

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      grossMarginPercentage,
      netProfit: grossProfit, // Sin gastos operativos por ahora
      netMarginPercentage: grossMarginPercentage,
      averageMarginPerSale: invoices.length > 0 ? grossMarginPercentage : 0,
      topProfitableProducts,
      lowProfitableProducts: [], // TODO: implementar productos menos rentables
      marginsByCategory,
      trend: {
        previousPeriodGrossMargin: 0, // TODO: implementar comparación con período anterior
        currentPeriodGrossMargin: grossMarginPercentage,
        marginGrowth: 0,
        isImproving: grossMarginPercentage > 0,
        dailyMargins: [
          {
            date: (endDate || new Date()).toISOString(),
            grossMarginPercentage,
            dailyRevenue: totalRevenue,
            dailyCOGS: totalCOGS,
          },
        ],
      },
    };
  }
}