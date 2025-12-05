// src/customer-credits/entities/customer-credit.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { CreditPayment } from './credit-payment.entity';

/**
 * Estado del crédito
 */
export enum CreditStatus {
  PENDING = 'pending',         // Pendiente de pago
  PARTIALLY_PAID = 'partially_paid', // Parcialmente pagado
  PAID = 'paid',               // Pagado completamente
  CANCELLED = 'cancelled',     // Cancelado
  OVERDUE = 'overdue',         // Vencido
}

/**
 * Entidad de Crédito de Cliente
 * Representa una deuda del cliente cuando no paga el total de una factura
 */
@Entity('customer_credits')
@Index('IDX_customer_credits_customer', ['customerId'])
@Index('IDX_customer_credits_organization', ['organizationId'])
@Index('IDX_customer_credits_status', ['status'])
@Index('IDX_customer_credits_due_date', ['dueDate'])
export class CustomerCredit extends BaseEntity {
  /**
   * Monto original del crédito (deuda)
   */
  @Column({
    name: 'original_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  originalAmount: number;

  /**
   * Monto pagado hasta el momento
   */
  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  paidAmount: number;

  /**
   * Saldo pendiente (calculado: originalAmount - paidAmount)
   */
  @Column({
    name: 'balance_due',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  balanceDue: number;

  /**
   * Estado del crédito
   */
  @Column({
    type: 'enum',
    enum: CreditStatus,
    default: CreditStatus.PENDING,
  })
  status: CreditStatus;

  /**
   * Fecha de vencimiento del crédito
   */
  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: Date;

  /**
   * Descripción o motivo del crédito
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Notas internas
   */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  // ==================== RELACIONES ====================

  /**
   * Cliente al que pertenece el crédito
   */
  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  /**
   * Factura que originó el crédito (opcional)
   */
  @Column({ type: 'uuid', name: 'invoice_id', nullable: true })
  invoiceId?: string;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  /**
   * Organización (multitenant)
   */
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * Usuario que creó el crédito
   */
  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  /**
   * Pagos realizados a este crédito
   */
  @OneToMany(() => CreditPayment, (payment) => payment.credit)
  payments: CreditPayment[];
}
