import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ExpenseCategory } from './expense-category.entity';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export enum ExpenseStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

export enum ExpenseType {
  OPERATING = 'operating',
  ADMINISTRATIVE = 'administrative',
  SALES = 'sales',
  FINANCIAL = 'financial',
  EXTRAORDINARY = 'extraordinary',
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  OTHER = 'other',
}

/**
 * Origen del pago de un gasto. Permite saber DE DÓNDE salió el dinero
 * (banco, caja del día, caja chica, aporte del dueño).
 *
 * - CASH_REGISTER: pagado con la caja del día (turno actual abierto).
 * - BANK_ACCOUNT: pagado desde una cuenta bancaria (requiere bankAccountId).
 * - PETTY_CASH: pagado con caja chica (fondo separado de la operación diaria).
 * - OWNER_CAPITAL: dueño/socio paga de su bolsillo (no afecta caja del negocio).
 */
export enum ExpensePaidFrom {
  CASH_REGISTER = 'cash_register',
  BANK_ACCOUNT = 'bank_account',
  PETTY_CASH = 'petty_cash',
  OWNER_CAPITAL = 'owner_capital',
}

@Entity('expenses')
export class Expense extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  amount: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: ExpenseStatus,
    default: ExpenseStatus.DRAFT,
  })
  status: ExpenseStatus;

  @Column({
    type: 'enum',
    enum: ExpenseType,
    default: ExpenseType.OPERATING,
  })
  type: ExpenseType;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  /**
   * Fuente del dinero con el que se pagó el gasto. Se asigna cuando el
   * gasto se marca como `paid`. Si es `BANK_ACCOUNT`, debe venir también
   * `bankAccountId`. El service descuenta del saldo de la cuenta y genera
   * un movement auditable `expense_payment`.
   */
  @Column({
    type: 'enum',
    enum: ExpensePaidFrom,
    name: 'paid_from',
    nullable: true,
  })
  paidFrom?: ExpensePaidFrom;

  /**
   * Cuenta bancaria desde la que se pagó (cuando paidFrom = BANK_ACCOUNT).
   * Sin FK formal para no acoplar tan fuerte; la consistencia se valida
   * en el service.
   */
  @Column({ type: 'uuid', name: 'bank_account_id', nullable: true })
  @Index()
  bankAccountId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vendor?: string; // Proveedor o beneficiario

  @Column({ type: 'varchar', length: 50, nullable: true })
  invoiceNumber?: string; // Número de factura del proveedor

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference?: string; // Referencia de pago

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  attachments?: string[]; // URLs de archivos adjuntos (recibos, facturas)

  @Column({ type: 'json', nullable: true })
  tags?: string[]; // Etiquetas para clasificación adicional

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Campos de aprobación
  @Column({ type: 'uuid', nullable: true })
  approvedById?: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.expenses)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relaciones
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => ExpenseCategory, (category) => category.expenses, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: ExpenseCategory;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy?: User;

  // Métodos útiles
  get isApproved(): boolean {
    return this.status === ExpenseStatus.APPROVED;
  }

  get isPaid(): boolean {
    return this.status === ExpenseStatus.PAID;
  }

  get isPending(): boolean {
    return this.status === ExpenseStatus.PENDING;
  }

  get isDraft(): boolean {
    return this.status === ExpenseStatus.DRAFT;
  }

  get isRejected(): boolean {
    return this.status === ExpenseStatus.REJECTED;
  }

  get requiresApproval(): boolean {
    // Lógica para determinar si requiere aprobación (ej: montos altos)
    return this.amount > 500000; // Más de 500k COP requiere aprobación
  }

  get formattedAmount(): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
    }).format(this.amount);
  }

  get daysOld(): number {
    const diffTime = new Date().getTime() - this.date.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
