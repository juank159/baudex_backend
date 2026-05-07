// src/bank-accounts/entities/bank-account-movement.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { BankAccount } from './bank-account.entity';

/**
 * Tipos de movimiento de una cuenta bancaria.
 * Cada movement representa un cambio en el saldo y queda como historial
 * auditable. Se generan automáticamente desde otros módulos (invoices,
 * credit_payments, expenses) o manualmente por el usuario (deposits,
 * withdrawals, transfers).
 */
export enum BankAccountMovementType {
  /** Saldo inicial al crear la cuenta */
  INITIAL_BALANCE = 'initial_balance',
  /** Depósito manual (el dueño/empleado mete plata) */
  DEPOSIT = 'deposit',
  /** Retiro manual (saca plata para gastar fuera del sistema) */
  WITHDRAWAL = 'withdrawal',
  /** Pago de factura recibido en esta cuenta */
  INVOICE_PAYMENT = 'invoice_payment',
  /** Abono a crédito de cliente recibido en esta cuenta */
  CREDIT_PAYMENT = 'credit_payment',
  /** Gasto pagado desde esta cuenta */
  EXPENSE_PAYMENT = 'expense_payment',
  /** Transferencia salida hacia otra cuenta (resta) */
  TRANSFER_OUT = 'transfer_out',
  /** Transferencia entrada desde otra cuenta (suma) */
  TRANSFER_IN = 'transfer_in',
  /** Ajuste manual (correcciones de auditoría) */
  ADJUSTMENT = 'adjustment',
  /** Refund de un pago anterior (nota crédito que devuelve dinero) */
  REFUND = 'refund',
}

@Entity('bank_account_movements')
@Index('IDX_bam_organization', ['organizationId'])
@Index('IDX_bam_account', ['bankAccountId'])
@Index('IDX_bam_account_date', ['bankAccountId', 'movementDate'])
@Index('IDX_bam_reference', ['referenceType', 'referenceId'])
export class BankAccountMovement extends BaseEntity {
  @Column({ type: 'uuid', name: 'bank_account_id' })
  bankAccountId: string;

  @ManyToOne(() => BankAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: BankAccount;

  @Column({
    type: 'enum',
    enum: BankAccountMovementType,
  })
  type: BankAccountMovementType;

  /**
   * Monto del movimiento. SIEMPRE positivo. El signo (entrada/salida) lo
   * determina el `type`. Esto facilita reportes y evita errores de signo.
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string | number) =>
        typeof v === 'string' ? parseFloat(v) || 0 : (v ?? 0),
    },
  })
  amount: number;

  /**
   * Saldo de la cuenta DESPUÉS de aplicar este movimiento. Snapshot histórico
   * que permite reconstruir el saldo en cualquier momento sin recalcular.
   * Críticos para auditoría y reportes.
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'balance_after',
    transformer: {
      to: (v: number) => v,
      from: (v: string | number) =>
        typeof v === 'string' ? parseFloat(v) || 0 : (v ?? 0),
    },
  })
  balanceAfter: number;

  /**
   * Fecha del movimiento (puede diferir del createdAt si se registra retroactivo).
   */
  @Column({ type: 'timestamptz', name: 'movement_date' })
  movementDate: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description?: string;

  /**
   * Tipo del documento que originó el movimiento (cuando aplica).
   * Ejemplo: 'invoice', 'credit_payment', 'expense', 'transfer'.
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'reference_type',
  })
  referenceType?: string;

  /** ID del documento referenciado (factura, pago de crédito, gasto, etc) */
  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId?: string;

  /**
   * Para transferencias entre cuentas: ID de la cuenta contraparte.
   * En `TRANSFER_OUT` apunta a la cuenta destino. En `TRANSFER_IN` apunta a
   * la cuenta origen. Permite agrupar las dos mitades de la transferencia.
   */
  @Column({ type: 'uuid', nullable: true, name: 'counterparty_account_id' })
  counterpartyAccountId?: string;

  /**
   * ID del movement contraparte cuando es transferencia. Permite navegar
   * de un lado al otro de la operación atómica.
   */
  @Column({ type: 'uuid', nullable: true, name: 'counterparty_movement_id' })
  counterpartyMovementId?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Multi-tenant
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById?: string;

  // ==================== Helpers ====================

  /**
   * Indica si este tipo de movimiento SUMA al saldo (entrada de dinero).
   */
  static isInflow(type: BankAccountMovementType): boolean {
    return [
      BankAccountMovementType.INITIAL_BALANCE,
      BankAccountMovementType.DEPOSIT,
      BankAccountMovementType.INVOICE_PAYMENT,
      BankAccountMovementType.CREDIT_PAYMENT,
      BankAccountMovementType.TRANSFER_IN,
    ].includes(type);
  }

  /**
   * Indica si este tipo de movimiento RESTA del saldo (salida de dinero).
   */
  static isOutflow(type: BankAccountMovementType): boolean {
    return [
      BankAccountMovementType.WITHDRAWAL,
      BankAccountMovementType.EXPENSE_PAYMENT,
      BankAccountMovementType.TRANSFER_OUT,
      BankAccountMovementType.REFUND,
    ].includes(type);
  }

  /**
   * Adjustment puede ser positivo o negativo según el monto, así que
   * se calcula del balanceAfter, no del tipo.
   */
}
