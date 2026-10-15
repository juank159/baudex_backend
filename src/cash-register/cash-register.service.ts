// src/cash-register/cash-register.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { TenantAwareService } from '../common/services/tenant-aware.service';
import {
  CashRegister,
  CashRegisterStatus,
} from './entities/cash-register.entity';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';

/**
 * Servicio de Caja Registradora.
 *
 * Modelo simple: una sola caja abierta por organización a la vez.
 * Cualquier usuario autorizado de la organización puede abrir/cerrar.
 *
 * El servicio NO modifica facturas/gastos directamente. Otros módulos
 * consultan `getOpenCashRegister(orgId)` cuando crean transacciones en
 * efectivo para vincularlas. Este servicio se encarga de:
 *   - Apertura/cierre con validaciones
 *   - Cálculo de resumen del turno (qué entró/salió de la caja)
 *   - Comparación esperado vs contado
 */
@Injectable()
export class CashRegisterService {
  constructor(
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,
    private readonly tenantService: TenantAwareService,
    @InjectEntityManager() private readonly em: EntityManager,
  ) {}

  /**
   * Devuelve la caja abierta del tenant si existe, o null si todas las
   * cajas están cerradas. Otros módulos (invoices, expenses) lo usan
   * para vincular transacciones en efectivo al turno actual.
   */
  async getOpenCashRegister(
    organizationId?: string,
  ): Promise<CashRegister | null> {
    const orgId = organizationId ?? this.tenantService.getTenantId();
    if (!orgId) return null;

    return this.cashRegisterRepository.findOne({
      where: {
        organizationId: orgId,
        status: CashRegisterStatus.OPEN,
      },
      relations: ['openedBy'],
    });
  }

  /**
   * Abrir caja. Falla si ya hay una caja abierta para esta organización
   * (no se permiten cajas concurrentes en el modelo simple).
   */
  async open(
    dto: OpenCashRegisterDto,
    userId: string,
  ): Promise<CashRegister> {
    const orgId = this.tenantService.getTenantId();
    if (!orgId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Reenvío de una apertura que ya llegó (reintento de la cola o de una
    // apertura hecha sin conexión): devolver la misma caja, no duplicarla.
    if (dto.id) {
      const same = await this.cashRegisterRepository.findOne({
        where: { id: dto.id, organizationId: orgId },
        relations: ['openedBy', 'closedBy'],
      });
      if (same) return same;
    }

    const existing = await this.getOpenCashRegister(orgId);
    if (existing) {
      throw new ConflictException(
        `Ya hay una caja abierta desde ${existing.openedAt.toISOString()}. Ciérrala primero.`,
      );
    }

    const cashRegister = this.cashRegisterRepository.create({
      ...(dto.id ? { id: dto.id } : {}),
      status: CashRegisterStatus.OPEN,
      openingAmount: dto.openingAmount,
      openingNotes: dto.openingNotes,
      openedAt: this.deviceTime(dto.openedAt) ?? new Date(),
      openedById: userId,
      organizationId: orgId,
    });

    return this.cashRegisterRepository.save(cashRegister);
  }

  /**
   * ¿El movimiento en efectivo ocurrió hace rato y llega ahora desde la cola
   * de sincronización (venta, abono o gasto hecho sin conexión)?
   *
   * La regla "debe haber caja abierta" es para los movimientos EN VIVO. Uno
   * que llega desde la cola ya ocurrió: la app exigió la caja abierta en ese
   * momento, y la caja pudo cerrarse antes de que volviera la conexión.
   * Rechazarlo dejaría una venta real sin registrar, así que se acepta; el
   * cuadre de caja lo ubica en su turno por la fecha del pago.
   */
  static isQueuedEvent(occurredAt?: Date | string | null): boolean {
    if (!occurredAt) return false;
    const date = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
    if (isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() > 5 * 60 * 1000;
  }

  /**
   * Hora informada por el equipo (operación hecha sin conexión). Se acepta
   * si es válida y no está en el futuro; si el reloj del equipo va
   * adelantado se usa la hora del servidor.
   */
  private deviceTime(value?: string, notBefore?: Date): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    if (date > now) return now;
    if (notBefore && date < notBefore) return notBefore;
    return date;
  }

  /**
   * Cerrar caja. Calcula el efectivo esperado a partir de las
   * transacciones del turno y persiste el snapshot inmutable del
   * resumen + la diferencia con lo contado físicamente.
   */
  async close(
    id: string,
    dto: CloseCashRegisterDto,
    userId: string,
  ): Promise<CashRegister> {
    const cashRegister = await this.findOne(id);

    if (cashRegister.status === CashRegisterStatus.CLOSED) {
      // Reenvío del mismo cierre (reintento de la cola): ya quedó hecho.
      if (
        Number(cashRegister.closingActualAmount) === Number(dto.closingActualAmount)
      ) {
        return cashRegister;
      }
      throw new BadRequestException('Esta caja ya está cerrada');
    }

    // El turno termina a la hora real del cierre (puede venir de un cierre
    // hecho sin conexión); el resumen se calcula hasta esa hora.
    cashRegister.closedAt =
      this.deviceTime(dto.closedAt, cashRegister.openedAt) ?? new Date();

    const summary = await this.computeSummary(cashRegister);
    const expected =
      cashRegister.openingAmount +
      summary.cashSales +
      summary.cashDeposits -
      summary.cashExpenses -
      summary.cashWithdrawals;
    const difference = dto.closingActualAmount - expected;

    cashRegister.status = CashRegisterStatus.CLOSED;
    cashRegister.closingActualAmount = dto.closingActualAmount;
    cashRegister.closingExpectedAmount = expected;
    cashRegister.closingDifference = Math.round(difference * 100) / 100;
    cashRegister.closingSummary = summary;
    cashRegister.closingNotes = dto.closingNotes;
    cashRegister.closedById = userId;

    return this.cashRegisterRepository.save(cashRegister);
  }

  /**
   * Resumen del turno actual (sin cerrar). Útil para mostrar en la UI
   * cuánto debería haber en caja en este momento.
   */
  async getCurrentSummary(): Promise<{
    cashRegister: CashRegister | null;
    summary: ReturnType<CashRegisterService['_emptySummary']>;
    expectedAmount: number;
  }> {
    const cashRegister = await this.getOpenCashRegister();
    if (!cashRegister) {
      return {
        cashRegister: null,
        summary: this._emptySummary(),
        expectedAmount: 0,
      };
    }
    const summary = await this.computeSummary(cashRegister);
    const expected =
      cashRegister.openingAmount +
      summary.cashSales +
      summary.cashDeposits -
      summary.cashExpenses -
      summary.cashWithdrawals;
    return { cashRegister, summary, expectedAmount: expected };
  }

  /**
   * Listar cajas (historial). Por defecto trae las más recientes
   * primero, con límite y filtro opcional de status.
   */
  async list(params: {
    status?: CashRegisterStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CashRegister[]; total: number }> {
    const orgId = this.tenantService.getTenantId();
    if (!orgId) throw new BadRequestException('Sin organización');

    const limit = Math.min(params.limit ?? 30, 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const qb = this.cashRegisterRepository
      .createQueryBuilder('cr')
      .leftJoinAndSelect('cr.openedBy', 'openedBy')
      .leftJoinAndSelect('cr.closedBy', 'closedBy')
      .where('cr.organizationId = :orgId', { orgId })
      .andWhere('cr.deletedAt IS NULL');

    if (params.status) {
      qb.andWhere('cr.status = :status', { status: params.status });
    }

    const total = await qb.getCount();
    const items = await qb
      .orderBy('cr.openedAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return { items, total };
  }

  /**
   * Obtener una caja por ID dentro del tenant.
   */
  async findOne(id: string): Promise<CashRegister> {
    const orgId = this.tenantService.getTenantId();
    if (!orgId) throw new BadRequestException('Sin organización');

    const cashRegister = await this.cashRegisterRepository.findOne({
      where: { id, organizationId: orgId },
      relations: ['openedBy', 'closedBy'],
    });
    if (!cashRegister) {
      throw new NotFoundException(`Caja con ID ${id} no encontrada`);
    }
    return cashRegister;
  }

  // ==================== Cálculo del resumen del turno ====================

  /**
   * Calcula totales del turno desde la apertura. Si está cerrada,
   * usa la fecha de cierre como ventana superior; si está abierta,
   * usa NOW().
   *
   * Cuenta:
   *   - Ventas en efectivo: `payments.payment_method='cash'` cuya
   *     `payment_date` cae en el rango.
   *   - Gastos pagados con caja: `expenses.paid_from='cash_register'`
   *     y `status='paid'` cuyo `updated_at` cae en el rango.
   *   - Notas de crédito aplicadas: para que el cajero vea cuánto
     se devolvió en el turno (no afecta caja directamente porque las
     NCs se pagan por otros medios habitualmente, pero es info útil).
   *   - Depósitos manuales / retiros: por ahora 0 (Phase 2.x agrega
   *     movimientos directos a caja).
   */
  private async computeSummary(
    cashRegister: CashRegister,
  ): Promise<NonNullable<CashRegister['closingSummary']>> {
    const start = cashRegister.openedAt;
    const end = cashRegister.closedAt ?? new Date();
    const orgId = cashRegister.organizationId;

    // ✅ INGRESOS DE EFECTIVO AL TURNO — incluye:
    //   (a) `payments.paymentMethod='cash'` → cubre cobros de facturas y
    //       los pagos a créditos vinculados a facturas (el módulo de
    //       créditos crea un `Payment` espejo cuando hay invoiceId).
    //   (b) `credit_payments.paymentMethod='cash'` cuyo crédito es
    //       DIRECTO (sin invoiceId) → estos pagos NO generan `Payment`
    //       espejo, así que sin este UNION quedaban sin contabilizar
    //       en el efectivo del día. El cajero recibía el dinero pero la
    //       caja no lo veía.
    const [salesAgg] = await this.em.query(
      `
      SELECT
        COALESCE(SUM(amount), 0)::numeric AS total,
        COUNT(*)::int AS count
      FROM (
        SELECT p.amount
        FROM payments p
        WHERE p.organization_id = $1
          AND p.deleted_at IS NULL
          AND p."paymentMethod" = 'cash'
          AND p."paymentDate" >= $2
          AND p."paymentDate" <= $3
        UNION ALL
        SELECT cp.amount
        FROM credit_payments cp
        JOIN customer_credits cc ON cc.id = cp.credit_id
        WHERE cp.organization_id = $1
          AND cp.deleted_at IS NULL
          AND cp.payment_method = 'cash'
          AND cp.payment_date >= $2
          AND cp.payment_date <= $3
          AND cc.invoice_id IS NULL
      ) cash_in
      `,
      [orgId, start, end],
    );

    const [expensesAgg] = await this.em.query(
      `
      SELECT
        COALESCE(SUM(e.amount), 0)::numeric AS total,
        COUNT(*)::int AS count
      FROM expenses e
      WHERE e.organization_id = $1
        AND e.deleted_at IS NULL
        AND e.paid_from = 'cash_register'
        AND e.status = 'paid'
        AND e.updated_at >= $2
        AND e.updated_at <= $3
      `,
      [orgId, start, end],
    );

    const [invoicesAgg] = await this.em.query(
      `
      SELECT COUNT(DISTINCT p."invoiceId")::int AS count
      FROM payments p
      WHERE p.organization_id = $1
        AND p.deleted_at IS NULL
        AND p."paymentMethod" = 'cash'
        AND p."paymentDate" >= $2
        AND p."paymentDate" <= $3
      `,
      [orgId, start, end],
    );

    const [creditNotesAgg] = await this.em.query(
      `
      SELECT
        COALESCE(SUM(cn.total), 0)::numeric AS total,
        COUNT(*)::int AS count
      FROM credit_notes cn
      WHERE cn.organization_id = $1
        AND cn.deleted_at IS NULL
        AND cn.status = 'confirmed'
        AND COALESCE(cn.applied_at, cn.date) >= $2
        AND COALESCE(cn.applied_at, cn.date) <= $3
      `,
      [orgId, start, end],
    );

    // ── DESGLOSE DEL TURNO ──────────────────────────────────────────────
    // (1) De dónde salió el efectivo: ventas vs abonos a créditos.
    //     Los abonos a créditos de factura quedan en `payments` con
    //     referencia SYNC-CRD-…; los de créditos directos solo en
    //     `credit_payments`.
    const [cashOriginAgg] = await this.em.query(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE NOT is_credit_payment), 0)::numeric AS sales_total,
        COUNT(*) FILTER (WHERE NOT is_credit_payment)::int                     AS sales_count,
        COALESCE(SUM(amount) FILTER (WHERE is_credit_payment), 0)::numeric     AS credit_total,
        COUNT(*) FILTER (WHERE is_credit_payment)::int                         AS credit_count
      FROM (
        SELECT p.amount, COALESCE(p.reference, '') LIKE 'SYNC-CRD-%' AS is_credit_payment
        FROM payments p
        WHERE p.organization_id = $1
          AND p.deleted_at IS NULL
          AND p."paymentMethod" = 'cash'
          AND p."paymentDate" >= $2
          AND p."paymentDate" <= $3
        UNION ALL
        SELECT cp.amount, TRUE AS is_credit_payment
        FROM credit_payments cp
        JOIN customer_credits cc ON cc.id = cp.credit_id
        WHERE cp.organization_id = $1
          AND cp.deleted_at IS NULL
          AND cp.payment_method = 'cash'
          AND cp.payment_date >= $2
          AND cp.payment_date <= $3
          AND cc.invoice_id IS NULL
      ) cash_in
      `,
      [orgId, start, end],
    );

    // (2) Cobros por otros medios: dinero real que entró al negocio en el
    //     turno pero NO al cajón (está en Nequi, banco, datáfono...). No
    //     incluye 'credit' (fiado) ni saldo a favor: eso no es dinero nuevo.
    const otherMethodRows: {
      method: string;
      label: string;
      total: string;
      count: number;
    }[] = await this.em.query(
      `
      SELECT method, label, SUM(amount)::numeric AS total, COUNT(*)::int AS count
      FROM (
        SELECT p."paymentMethod" AS method,
               COALESCE(ba.name, p."paymentMethod") AS label,
               p.amount
        FROM payments p
        LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
        WHERE p.organization_id = $1
          AND p.deleted_at IS NULL
          AND p."paymentMethod" NOT IN ('cash', 'credit', 'client_balance', 'saldo_favor')
          AND p."paymentDate" >= $2
          AND p."paymentDate" <= $3
        UNION ALL
        SELECT cp.payment_method AS method,
               COALESCE(ba.name, cp.payment_method) AS label,
               cp.amount
        FROM credit_payments cp
        JOIN customer_credits cc ON cc.id = cp.credit_id
        LEFT JOIN bank_accounts ba ON ba.id = cp.bank_account_id
        WHERE cp.organization_id = $1
          AND cp.deleted_at IS NULL
          AND cp.payment_method NOT IN ('cash', 'credit', 'client_balance', 'saldo_favor')
          AND cp.payment_date >= $2
          AND cp.payment_date <= $3
          AND cc.invoice_id IS NULL
      ) other_in
      GROUP BY method, label
      ORDER BY SUM(amount) DESC
      `,
      [orgId, start, end],
    );

    // (3) Ventas fiadas en el turno: se vendió, pero aún no es dinero.
    const [creditSalesAgg] = await this.em.query(
      `
      SELECT COALESCE(SUM(cc.original_amount), 0)::numeric AS total,
             COUNT(*)::int AS count
      FROM customer_credits cc
      WHERE cc.organization_id = $1
        AND cc.deleted_at IS NULL
        AND cc.status <> 'cancelled'
        AND cc.created_at >= $2
        AND cc.created_at <= $3
      `,
      [orgId, start, end],
    );

    const round = (value: number) => Math.round(value * 100) / 100;
    const cashSales = parseFloat(salesAgg?.total ?? '0');
    const otherMethods = otherMethodRows.map((row) => ({
      method: row.method,
      label: row.label,
      total: parseFloat(row.total) || 0,
      count: Number(row.count) || 0,
    }));
    const otherMethodsTotal = round(otherMethods.reduce((sum, m) => sum + m.total, 0));

    return {
      cashSales,
      cashSalesCount: Number(salesAgg?.count ?? 0),
      cashExpenses: parseFloat(expensesAgg?.total ?? '0'),
      cashExpensesCount: Number(expensesAgg?.count ?? 0),
      cashDeposits: 0, // Phase futura: depósitos manuales a caja
      cashWithdrawals: 0, // Phase futura: retiros manuales de caja
      invoicesCount: Number(invoicesAgg?.count ?? 0),
      creditNotesCount: Number(creditNotesAgg?.count ?? 0),
      creditNotesTotal: parseFloat(creditNotesAgg?.total ?? '0'),

      cashFromSales: parseFloat(cashOriginAgg?.sales_total ?? '0'),
      cashFromSalesCount: Number(cashOriginAgg?.sales_count ?? 0),
      cashFromCreditPayments: parseFloat(cashOriginAgg?.credit_total ?? '0'),
      cashFromCreditPaymentsCount: Number(cashOriginAgg?.credit_count ?? 0),
      otherMethods,
      otherMethodsTotal,
      otherMethodsCount: otherMethods.reduce((sum, m) => sum + m.count, 0),
      totalCollected: round(cashSales + otherMethodsTotal),
      creditSalesTotal: parseFloat(creditSalesAgg?.total ?? '0'),
      creditSalesCount: Number(creditSalesAgg?.count ?? 0),
    };
  }

  private _emptySummary() {
    return {
      cashSales: 0,
      cashSalesCount: 0,
      cashExpenses: 0,
      cashExpensesCount: 0,
      cashDeposits: 0,
      cashWithdrawals: 0,
      invoicesCount: 0,
      creditNotesCount: 0,
      creditNotesTotal: 0,
    };
  }
}
