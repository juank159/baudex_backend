// src/cash-register/cash-register.service.ts
import {
  BadRequestException,
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

    const existing = await this.getOpenCashRegister(orgId);
    if (existing) {
      throw new BadRequestException(
        `Ya hay una caja abierta desde ${existing.openedAt.toISOString()}. Ciérrala primero.`,
      );
    }

    const cashRegister = this.cashRegisterRepository.create({
      status: CashRegisterStatus.OPEN,
      openingAmount: dto.openingAmount,
      openingNotes: dto.openingNotes,
      openedAt: new Date(),
      openedById: userId,
      organizationId: orgId,
    });

    return this.cashRegisterRepository.save(cashRegister);
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
      throw new BadRequestException('Esta caja ya está cerrada');
    }

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
    cashRegister.closedAt = new Date();
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

    const [salesAgg] = await this.em.query(
      `
      SELECT
        COALESCE(SUM(p.amount), 0)::numeric AS total,
        COUNT(*)::int AS count
      FROM payments p
      WHERE p.organization_id = $1
        AND p.deleted_at IS NULL
        AND p."paymentMethod" = 'cash'
        AND p."paymentDate" >= $2
        AND p."paymentDate" <= $3
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

    return {
      cashSales: parseFloat(salesAgg?.total ?? '0'),
      cashSalesCount: Number(salesAgg?.count ?? 0),
      cashExpenses: parseFloat(expensesAgg?.total ?? '0'),
      cashExpensesCount: Number(expensesAgg?.count ?? 0),
      cashDeposits: 0, // Phase futura: depósitos manuales a caja
      cashWithdrawals: 0, // Phase futura: retiros manuales de caja
      invoicesCount: Number(invoicesAgg?.count ?? 0),
      creditNotesCount: Number(creditNotesAgg?.count ?? 0),
      creditNotesTotal: parseFloat(creditNotesAgg?.total ?? '0'),
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
