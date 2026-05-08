// src/cash-register/entities/cash-register.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Estado de la caja registradora.
 *
 * - OPEN: turno activo. Las ventas en efectivo y gastos pagados de
 *   caja se vinculan automáticamente a esta caja.
 * - CLOSED: turno cerrado. Inmutable después del cierre.
 */
export enum CashRegisterStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

/**
 * Caja registradora (turno de caja). Representa el período entre que
 * se abre la caja con un saldo inicial y se cierra contando el efectivo
 * físico final, comparando con lo que el sistema esperaba.
 *
 * Modelo simple: UNA caja abierta por organización a la vez. Cualquier
 * usuario autorizado puede abrirla/cerrarla. Suficiente para la mayoría
 * de negocios pequeños/medianos. Si después se necesita multi-caja
 * (por dispositivo o sucursal), se puede extender con un campo
 * `terminalId` o `branchId`.
 */
@Entity('cash_registers')
@Index('IDX_cash_registers_org_status', ['organizationId', 'status'])
export class CashRegister extends BaseEntity {
  @Column({
    type: 'enum',
    enum: CashRegisterStatus,
    default: CashRegisterStatus.OPEN,
  })
  status: CashRegisterStatus;

  /**
   * Saldo inicial declarado al abrir la caja. Es el efectivo físico
   * con el que el cajero arranca el turno (cambio, fondo de caja, etc).
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'opening_amount',
    transformer: {
      to: (v: number) => v,
      from: (v: string | number) =>
        typeof v === 'string' ? parseFloat(v) || 0 : (v ?? 0),
    },
  })
  openingAmount: number;

  /**
   * Lo que el SISTEMA espera que haya en caja al cierre. Se calcula:
   *   openingAmount + cash_sales + cash_deposits - cash_expenses - cash_withdrawals
   * Se calcula al cierre y se persiste como snapshot histórico.
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'closing_expected_amount',
    nullable: true,
    transformer: {
      to: (v: number | null | undefined) => v,
      from: (v: string | number | null) =>
        v == null ? null : typeof v === 'string' ? parseFloat(v) || 0 : v,
    },
  })
  closingExpectedAmount?: number;

  /**
   * Lo que el cajero EFECTIVAMENTE contó al cierre. Si hay diferencia
   * con `closingExpectedAmount`, queda registrada en `closingDifference`
   * (positiva = sobrante, negativa = faltante).
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'closing_actual_amount',
    nullable: true,
    transformer: {
      to: (v: number | null | undefined) => v,
      from: (v: string | number | null) =>
        v == null ? null : typeof v === 'string' ? parseFloat(v) || 0 : v,
    },
  })
  closingActualAmount?: number;

  /**
   * Diferencia: actualAmount - expectedAmount.
   * - 0  → cuadre perfecto.
   * - > 0 → sobrante (más efectivo del esperado).
   * - < 0 → faltante (menos efectivo, alerta).
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'closing_difference',
    nullable: true,
    transformer: {
      to: (v: number | null | undefined) => v,
      from: (v: string | number | null) =>
        v == null ? null : typeof v === 'string' ? parseFloat(v) || 0 : v,
    },
  })
  closingDifference?: number;

  /**
   * Snapshot del resumen del turno al cierre. Persiste totales para
   * que el reporte de cierre no dependa de queries en vivo (que pueden
   * cambiar si después se editan ventas/gastos del turno).
   */
  @Column({ type: 'json', nullable: true, name: 'closing_summary' })
  closingSummary?: {
    cashSales: number;
    cashSalesCount: number;
    cashExpenses: number;
    cashExpensesCount: number;
    cashDeposits: number;
    cashWithdrawals: number;
    invoicesCount: number;
    creditNotesCount: number;
    creditNotesTotal: number;
  };

  @Column({ type: 'timestamptz', name: 'opened_at' })
  openedAt: Date;

  @Column({ type: 'uuid', name: 'opened_by_id' })
  openedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'opened_by_id' })
  openedBy: User;

  @Column({ type: 'timestamptz', name: 'closed_at', nullable: true })
  closedAt?: Date;

  @Column({ type: 'uuid', name: 'closed_by_id', nullable: true })
  closedById?: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'closed_by_id' })
  closedBy?: User;

  @Column({ type: 'text', nullable: true, name: 'opening_notes' })
  openingNotes?: string;

  @Column({ type: 'text', nullable: true, name: 'closing_notes' })
  closingNotes?: string;

  // Multi-tenant
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // ==================== Helpers ====================

  get isOpen(): boolean {
    return this.status === CashRegisterStatus.OPEN;
  }

  get isClosed(): boolean {
    return this.status === CashRegisterStatus.CLOSED;
  }
}
