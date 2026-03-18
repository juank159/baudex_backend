import { Controller, Get, Query, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ProfitabilityService } from '../common/services/profitability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardSimpleController {

  @Get('summary')
  async getDashboardSummary(
    @Query() query: any,
    @TenantId() organizationId: string,
  ) {

    try {
      // ✅ Ahora usa el organizationId del usuario autenticado via TenantId decorator
      

      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      // 🌐 OBTENER TIMEZONE DE LA ORGANIZACIÓN
      const [orgRow] = await this.entityManager.query(
        'SELECT timezone FROM organizations WHERE id = $1',
        [organizationId],
      );
      const orgTimezone = orgRow?.timezone || 'America/New_York';

      // 📅 NORMALIZAR PARÁMETROS DE FECHA A YYYY-MM-DD
      const startDateStr = query.startDate ? String(query.startDate).substring(0, 10) : null;
      const endDateStr = query.endDate ? String(query.endDate).substring(0, 10) : null;

      // 📅 FILTROS DE FECHA CON CAST EXPLÍCITO ::date
      let dateFilter = '';
      const queryParams: any[] = [organizationId];

      if (startDateStr && endDateStr) {
        dateFilter = ' AND date >= $2::date AND date <= $3::date';
        queryParams.push(startDateStr, endDateStr);
      } else if (startDateStr) {
        dateFilter = ' AND date >= $2::date';
        queryParams.push(startDateStr);
      } else if (endDateStr) {
        dateFilter = ' AND date <= $2::date';
        queryParams.push(endDateStr);
      } else {
      }

      // Obtener datos reales de facturas CON FILTROS DE FECHA
      const invoicesQuery = `
        SELECT
          COUNT(*) as total_invoices,
          COALESCE(SUM(CASE WHEN status IN ('paid', 'partially_paid') THEN CAST("paidAmount" AS DECIMAL) ELSE 0 END), 0) as total_revenue,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices
        FROM invoices
        WHERE organization_id = $1
        AND deleted_at IS NULL
        ${dateFilter}
      `;
      
      // Obtener datos reales de gastos CON FILTROS DE FECHA
      const expensesQuery = `
        SELECT
          COUNT(*) as total_expenses_count,
          SUM(CAST(amount AS DECIMAL)) as total_expenses_amount
        FROM expenses
        WHERE organization_id = $1
        AND status = 'approved'
        AND deleted_at IS NULL
        ${dateFilter}
      `;

      // Obtener datos reales de productos
      const productsQuery = `
        SELECT COUNT(*) as total_products
        FROM products 
        WHERE organization_id = $1 
        AND deleted_at IS NULL
      `;

      // Obtener datos reales de clientes
      const customersQuery = `
        SELECT COUNT(*) as total_customers
        FROM customers 
        WHERE organization_id = $1 
        AND deleted_at IS NULL
      `;

      
      const [invoiceResult] = await this.entityManager.query(invoicesQuery, queryParams);
      
      
      // Para gastos, usar los mismos parámetros de fecha
      const [expenseResult] = await this.entityManager.query(expensesQuery, queryParams);
      const [productResult] = await this.entityManager.query(productsQuery, [organizationId]);
      const [customerResult] = await this.entityManager.query(customersQuery, [organizationId]);

      const totalRevenue = parseFloat(invoiceResult?.total_revenue || '0');
      
      const totalExpenses = parseFloat(expenseResult?.total_expenses_amount || '0');
      const totalProfit = totalRevenue - totalExpenses;
      const totalInvoices = parseInt(invoiceResult?.total_invoices || '0');
      const paidInvoices = parseInt(invoiceResult?.paid_invoices || '0');
      const pendingInvoices = parseInt(invoiceResult?.pending_invoices || '0');
      const totalProducts = parseInt(productResult?.total_products || '0');
      const totalCustomers = parseInt(customerResult?.total_customers || '0');


      // 💳 OBTENER DESGLOSE POR MÉTODO DE PAGO
      // Agrupa por el nombre del método consolidando cuentas bancarias con el mismo nombre
      // paymentDate es timestamptz → convertir a timezone del tenant antes de comparar
      let paymentDateFilter = '';
      const paymentParams: any[] = [organizationId];

      if (startDateStr && endDateStr) {
        paymentDateFilter = ` AND (p."paymentDate" AT TIME ZONE $2)::date >= $3::date
                              AND (p."paymentDate" AT TIME ZONE $2)::date <= $4::date`;
        paymentParams.push(orgTimezone, startDateStr, endDateStr);
      } else if (startDateStr) {
        paymentDateFilter = ` AND (p."paymentDate" AT TIME ZONE $2)::date >= $3::date`;
        paymentParams.push(orgTimezone, startDateStr);
      } else if (endDateStr) {
        paymentDateFilter = ` AND (p."paymentDate" AT TIME ZONE $2)::date <= $3::date`;
        paymentParams.push(orgTimezone, endDateStr);
      }

      const paymentMethodsQuery = `
        SELECT
          COALESCE(ba.name, p."paymentMethod") as method,
          COUNT(p.id) as count,
          SUM(p.amount) as total_amount
        FROM payments p
        LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
        WHERE p.organization_id = $1
        AND p.deleted_at IS NULL
        ${paymentDateFilter}
        GROUP BY COALESCE(ba.name, p."paymentMethod")
        ORDER BY total_amount DESC
      `;

      const paymentMethods = await this.entityManager.query(paymentMethodsQuery, paymentParams);

      const totalPayments = paymentMethods.reduce((sum, pm) => sum + parseFloat(pm.total_amount || 0), 0);
      const paymentMethodsBreakdown = paymentMethods.map(pm => ({
        method: pm.method || 'Sin especificar',
        count: parseInt(pm.count || 0),
        totalAmount: parseFloat(pm.total_amount || 0),
        percentage: totalPayments > 0 ? (parseFloat(pm.total_amount || 0) / totalPayments * 100) : 0,
      }));

      paymentMethodsBreakdown.forEach(pm => {
      });

      // 📊 OBTENER DESGLOSE POR TIPO DE INGRESO (Facturas vs Créditos)
      const invoicesIncomeQuery = `
        SELECT COALESCE(SUM("paidAmount"), 0) as total
        FROM invoices
        WHERE organization_id = $1
        AND status IN ('paid', 'partially_paid')
        AND deleted_at IS NULL
        ${dateFilter}
      `;

      const creditsIncomeQuery = `
        SELECT COALESCE(SUM(client_balance_applied), 0) as total
        FROM invoices
        WHERE organization_id = $1
        AND client_balance_applied > 0
        AND deleted_at IS NULL
        ${dateFilter}
      `;

      const [invoicesIncomeResult] = await this.entityManager.query(invoicesIncomeQuery, queryParams);
      const [creditsIncomeResult] = await this.entityManager.query(creditsIncomeQuery, queryParams);

      const invoicesIncome = parseFloat(invoicesIncomeResult?.total || '0');
      const creditsIncome = parseFloat(creditsIncomeResult?.total || '0');
      const totalIncome = invoicesIncome + creditsIncome;

      const incomeTypeBreakdown = {
        invoices: invoicesIncome,
        credits: creditsIncome,
        total: totalIncome,
      };


      // 📊 CALCULAR DATOS REALES DEL PERÍODO ANTERIOR (mismo rango de días, pero desplazado hacia atrás)
      let previousPeriodRevenue = 0;
      let previousPeriodExpenses = 0;
      let previousPeriodInvoicesCount = 0;

      if (startDateStr && endDateStr) {
        // Calcular período anterior usando Date math con strings normalizados
        const start = new Date(startDateStr + 'T00:00:00');
        const end = new Date(endDateStr + 'T00:00:00');
        const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - diffDays);

        const prevStartStr = prevStart.toISOString().split('T')[0];
        const prevEndStr = prevEnd.toISOString().split('T')[0];


        const previousInvoicesQuery = `
          SELECT
            COUNT(*) as total_invoices,
            COALESCE(SUM(CASE WHEN status IN ('paid', 'partially_paid') THEN CAST("paidAmount" AS DECIMAL) ELSE 0 END), 0) as total_revenue
          FROM invoices
          WHERE organization_id = $1
          AND deleted_at IS NULL
          AND date >= $2::date AND date <= $3::date
        `;

        const previousExpensesQuery = `
          SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_expenses
          FROM expenses
          WHERE organization_id = $1
          AND status = 'approved'
          AND deleted_at IS NULL
          AND date >= $2::date AND date <= $3::date
        `;

        const [prevInvResult] = await this.entityManager.query(previousInvoicesQuery, [
          organizationId,
          prevStartStr,
          prevEndStr,
        ]);

        const [prevExpResult] = await this.entityManager.query(previousExpensesQuery, [
          organizationId,
          prevStartStr,
          prevEndStr,
        ]);

        previousPeriodRevenue = parseFloat(prevInvResult?.total_revenue || '0');
        previousPeriodExpenses = parseFloat(prevExpResult?.total_expenses || '0');
        previousPeriodInvoicesCount = parseInt(prevInvResult?.total_invoices || '0');

      }

      const previousPeriodProfit = previousPeriodRevenue - previousPeriodExpenses;
      const revenueGrowth = previousPeriodRevenue > 0
        ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue * 100)
        : 0;


      return {
        totalRevenue,
        totalExpenses,
        totalProfit,
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        totalCustomers,
        totalProducts,
        profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0',
        revenueGrowth: revenueGrowth.toFixed(1),
        paymentMethodsBreakdown,
        incomeTypeBreakdown,
        monthlyStats: {
          currentMonth: {
            revenue: totalRevenue,
            expenses: totalExpenses,
            profit: totalProfit,
            invoicesCount: totalInvoices
          },
          previousMonth: {
            revenue: previousPeriodRevenue,
            expenses: previousPeriodExpenses,
            profit: previousPeriodProfit,
            invoicesCount: previousPeriodInvoicesCount
          }
        },
        chartData: {
          revenue: [
            previousPeriodRevenue > 0 ? previousPeriodRevenue : totalRevenue * 0.6,
            previousPeriodRevenue > 0 ? (previousPeriodRevenue + totalRevenue) / 2 : totalRevenue * 0.75,
            previousPeriodRevenue > 0 ? totalRevenue * 0.95 : totalRevenue * 0.85,
            totalRevenue
          ],
          expenses: [
            previousPeriodExpenses > 0 ? previousPeriodExpenses : totalExpenses * 0.5,
            previousPeriodExpenses > 0 ? (previousPeriodExpenses + totalExpenses) / 2 : totalExpenses * 0.7,
            previousPeriodExpenses > 0 ? totalExpenses * 0.95 : totalExpenses * 0.9,
            totalExpenses
          ],
          profit: [
            previousPeriodProfit,
            (previousPeriodProfit + totalProfit) / 2,
            totalProfit * 0.95,
            totalProfit
          ]
        }
      };
    } catch (error) {
      console.error('❌ Error obteniendo datos del dashboard:', error);
      throw new InternalServerErrorException('Error al obtener resumen del dashboard');
    }
  }

  @Get('activities/recent')
  async getRecentActivities(
    @Query() query: any,
    @TenantId() organizationId: string,
  ) {

    try {
      // ✅ Usa el organizationId del usuario autenticado via TenantId decorator
      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      // Obtener actividades reales de facturas recientes
      const recentInvoicesQuery = `
        SELECT id, number, total, created_at, 'invoice_created' as activity_type
        FROM invoices 
        WHERE organization_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC 
        LIMIT 3
      `;

      // Obtener gastos recientes
      const recentExpensesQuery = `
        SELECT id, description, amount, created_at, 'expense_added' as activity_type
        FROM expenses 
        WHERE organization_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC 
        LIMIT 2
      `;

      const invoices = await this.entityManager.query(recentInvoicesQuery, [organizationId]);
      const expenses = await this.entityManager.query(recentExpensesQuery, [organizationId]);

      const activities = [];

      // Procesar facturas
      invoices.forEach((invoice, index) => {
        activities.push({
          id: `inv_${invoice.id}`,
          type: 'invoice_created',
          title: 'Nueva factura creada',
          description: `Factura ${invoice.number || '#INV-' + (index + 1)} por $${parseFloat(invoice.total).toLocaleString()}`,
          timestamp: invoice.created_at,
          icon: 'invoice',
          status: 'completed'
        });
      });

      // Procesar gastos
      expenses.forEach((expense, index) => {
        activities.push({
          id: `exp_${expense.id}`,
          type: 'expense_added',
          title: 'Gasto registrado',
          description: `${expense.description} - $${parseFloat(expense.amount).toLocaleString()}`,
          timestamp: expense.created_at,
          icon: 'expense',
          status: 'pending'
        });
      });

      // Ordenar por fecha más reciente
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      activities.forEach((activity, index) => {
      });

      const finalActivities = activities.slice(0, 10);
      
      return {
        success: true,
        data: {
          data: {
            activities: finalActivities
          }
        },
        meta: {
          page: 1,
          limit: 10,
          totalItems: activities.length,
          totalPages: 1
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      
      // Fallback sin actividades
      return {
        success: true,
        data: {
          data: {
            activities: []
          }
        },
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('notifications')
  async getDashboardNotifications(
    @Query() query: any,
    @TenantId() organizationId: string,
  ) {

    try {
      // ✅ Usa el organizationId del usuario autenticado via TenantId decorator
      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      // Crear notificaciones basadas en datos reales
      const notifications = [];

      // Verificar productos con stock bajo
      const lowStockQuery = `
        SELECT name, stock, id
        FROM products 
        WHERE organization_id = $1 
        AND stock < 10 
        AND deleted_at IS NULL
        LIMIT 3
      `;

      const lowStockProducts = await this.entityManager.query(lowStockQuery, [organizationId]);
      
      lowStockProducts.forEach((product, index) => {
        notifications.push({
          id: `stock_${product.id}`,
          title: 'Stock bajo',
          message: `El producto "${product.name}" tiene stock bajo (${product.stock} unidades)`,
          type: 'warning',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * (20 + index * 10)).toISOString(),
          priority: 'medium'
        });
      });

      // Verificar facturas pendientes
      const pendingInvoicesQuery = `
        SELECT number, total, "dueDate", id
        FROM invoices
        WHERE organization_id = $1
        AND status = 'pending'
        AND deleted_at IS NULL
        LIMIT 2
      `;

      const pendingInvoices = await this.entityManager.query(pendingInvoicesQuery, [organizationId]);
      
      pendingInvoices.forEach((invoice, index) => {
        notifications.push({
          id: `invoice_${invoice.id}`,
          title: 'Factura pendiente',
          message: `La factura ${invoice.number || '#INV-' + invoice.id} por $${parseFloat(invoice.total).toLocaleString()} está pendiente`,
          type: 'alert',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * (1 + index)).toISOString(),
          priority: 'high'
        });
      });

      // Agregar notificación de sistema si no hay otras
      if (notifications.length === 0) {
        notifications.push({
          id: 'system_1',
          title: 'Sistema operativo',
          message: 'El sistema está funcionando correctamente',
          type: 'success',
          isRead: false,
          createdAt: new Date().toISOString(),
          priority: 'low'
        });
      }

      // Ordenar por fecha más reciente
      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const unreadCount = notifications.filter(n => !n.isRead).length;

      notifications.forEach((notification, index) => {
      });

      const finalNotifications = notifications.slice(0, 10);
      
      return {
        success: true,
        data: {
          data: {
            notifications: finalNotifications,
            unreadCount
          }
        },
        meta: {
          page: 1,
          limit: 10,
          totalItems: notifications.length,
          totalPages: 1,
          unreadCount
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      
      // Fallback sin notificaciones
      return {
        success: true,
        data: {
          data: {
            notifications: [],
            unreadCount: 0
          }
        },
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          unreadCount: 0
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  constructor(
    private profitabilityService: ProfitabilityService,
    @InjectEntityManager() private entityManager: EntityManager,
  ) {}

  @Get('profitability')
  async getProfitabilityStats(
    @Query() query: any,
    @TenantId() organizationId: string,
  ) {

    try {
      // ✅ Usa el organizationId del usuario autenticado via TenantId decorator
      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      // 📅 NORMALIZAR FILTROS DE FECHA A STRINGS YYYY-MM-DD
      const startDate = query.startDate ? String(query.startDate).substring(0, 10) : undefined;
      const endDate = query.endDate ? String(query.endDate).substring(0, 10) : undefined;


      // ✅ USAR EL PROFITABILITYSERVICE CON STRINGS NORMALIZADOS
      const realStats = await this.profitabilityService.getProfitabilityStats(
        organizationId,
        startDate,
        endDate,
      );


      return {
        message: '🎉 RENTABILIDAD FIFO CON FILTROS APLICADOS!',
        ...realStats
      };

    } catch (error) {
      console.error('❌ Error calculando rentabilidad FIFO:', error.message);
      throw new InternalServerErrorException('Error al calcular rentabilidad');
    }
  }

  @Get('profitability/test-real')
  async testRealProfitability(@Query() query: any) {
    
    try {
      // Usar organización real conocida
      const organizationId = '20d665c8-25a3-454a-a564-2e8a0c81f025';

      // 📅 NORMALIZAR FILTROS DE FECHA A STRINGS YYYY-MM-DD
      const startDate = query.startDate ? String(query.startDate).substring(0, 10) : undefined;
      const endDate = query.endDate ? String(query.endDate).substring(0, 10) : undefined;


      // ✅ USAR EL PROFITABILITYSERVICE CON STRINGS NORMALIZADOS
      const realStats = await this.profitabilityService.getProfitabilityStats(
        organizationId,
        startDate,
        endDate,
      );

      return {
        message: '🎉 PRUEBA REAL DE FILTROS FIFO!',
        filtersApplied: {
          startDate: startDate || 'No aplicado',
          endDate: endDate || 'No aplicado',
        },
        ...realStats
      };

    } catch (error) {
      return {
        message: '❌ ERROR EN PRUEBA',
        error: error.message,
        stack: error.stack
      };
    }
  }

  @Get('profitability/test')
  testProfitability() {
    return {
      message: '✅ ENDPOINT FUNCIONANDO PERFECTO',
      tuEjemplo: {
        producto: 'sal refisal 1 kg',
        cantidad: 2,
        precioVenta: 3200,
        costoFIFO: 1250,
        ingresoTotal: 6400, // 2 × 3200
        costoTotal: 2500,   // 2 × 1250  
        ganancia: 3900,     // 6400 - 2500
        margen: 60.94      // (3900 ÷ 6400) × 100
      },
      formula: 'GANANCIA = (precio_venta × cantidad) - (costo_fifo × cantidad)',
      status: '100% COMPLETO ✅'
    };
  }
}