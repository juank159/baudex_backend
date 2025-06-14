import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  PARTIALLY_PAID = 'partially_paid',
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  CREDIT = 'credit',
  OTHER = 'other',
}

@Entity('invoices')
export class Invoice extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  number: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  // Totales calculados
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balanceDue: number;

  // Información adicional
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relaciones
  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, {
    cascade: true,
    eager: true,
  })
  items: InvoiceItem[];

  // Métodos útiles
  get isOverdue(): boolean {
    return new Date() > this.dueDate && this.status !== InvoiceStatus.PAID;
  }

  get isPaid(): boolean {
    return this.status === InvoiceStatus.PAID || this.balanceDue <= 0;
  }

  get isPartiallyPaid(): boolean {
    return this.paidAmount > 0 && this.paidAmount < this.total;
  }

  get daysOverdue(): number {
    if (!this.isOverdue) return 0;
    const diffTime = new Date().getTime() - this.dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Generar número de factura automáticamente
  @BeforeInsert()
  generateInvoiceNumber() {
    if (!this.number) {
      const year = new Date().getFullYear();
      const timestamp = Date.now().toString().slice(-6);
      this.number = `INV-${year}-${timestamp}`;
    }
  }

  // Calcular totales
  calculateTotals(): void {
    this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);

    // Aplicar descuento
    if (this.discountPercentage > 0) {
      this.discountAmount = (this.subtotal * this.discountPercentage) / 100;
    }

    const subtotalAfterDiscount = this.subtotal - this.discountAmount;

    // Calcular impuestos
    this.taxAmount = (subtotalAfterDiscount * this.taxPercentage) / 100;

    // Total final
    this.total = subtotalAfterDiscount + this.taxAmount;
    this.balanceDue = this.total - this.paidAmount;
  }
}
