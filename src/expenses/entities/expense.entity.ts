import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ExpenseCategory } from './expense-category.entity';
import { User } from '../../users/entities/user.entity';

export enum ExpenseStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

export enum ExpenseType {
  OPERATING = 'operating', // Gastos operativos
  ADMINISTRATIVE = 'administrative', // Gastos administrativos
  SALES = 'sales', // Gastos de ventas
  FINANCIAL = 'financial', // Gastos financieros
  EXTRAORDINARY = 'extraordinary', // Gastos extraordinarios
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  OTHER = 'other',
}

@Entity('expenses')
export class Expense extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
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

  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  // Relaciones
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => ExpenseCategory, (category) => category.expenses, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: ExpenseCategory;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
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
