// src/customer-credits/entities/client-balance-transaction.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { ClientBalance } from './client-balance.entity';
import { CustomerCredit } from './customer-credit.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';

/**
 * Tipo de transacción de saldo a favor
 */
export enum BalanceTransactionType {
  DEPOSIT = 'deposit',       // Dinero agregado al saldo (sobrepago, depósito directo)
  USAGE = 'usage',           // Saldo usado en pago de crédito
  REFUND = 'refund',         // Devolución de saldo al cliente (en efectivo/transferencia)
  ADJUSTMENT = 'adjustment', // Ajuste manual (corrección)
}

/**
 * Transacción de saldo a favor del cliente
 * Registra cada movimiento del saldo a favor
 */
@Entity('client_balance_transactions')
@Index('IDX_client_balance_trans_balance', ['clientBalanceId'])
@Index('IDX_client_balance_trans_type', ['type'])
@Index('IDX_client_balance_trans_organization', ['organizationId'])
export class ClientBalanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tipo de transacción
   */
  @Column({
    type: 'enum',
    enum: BalanceTransactionType,
  })
  type: BalanceTransactionType;

  /**
   * Monto de la transacción (siempre positivo)
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  amount: number;

  /**
   * Descripción de la transacción
   */
  @Column({ type: 'text' })
  description: string;

  /**
   * Saldo después de esta transacción (para historial)
   */
  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  balanceAfter: number;

  /**
   * Método de pago (solo para reembolsos)
   */
  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  // ==================== RELACIONES ====================

  /**
   * Saldo al que pertenece la transacción
   */
  @Column({ type: 'uuid', name: 'client_balance_id' })
  clientBalanceId: string;

  @ManyToOne(() => ClientBalance, (balance) => balance.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_balance_id' })
  clientBalance: ClientBalance;

  /**
   * Crédito relacionado (opcional)
   */
  @Column({ type: 'uuid', name: 'related_credit_id', nullable: true })
  relatedCreditId?: string;

  @ManyToOne(() => CustomerCredit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_credit_id' })
  relatedCredit?: CustomerCredit;

  /**
   * Factura relacionada (opcional)
   * Se usa cuando el saldo se aplica a una factura directamente
   */
  @Column({ type: 'uuid', name: 'related_invoice_id', nullable: true })
  relatedInvoiceId?: string;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_invoice_id' })
  relatedInvoice?: Invoice;

  /**
   * Organización (multitenant)
   */
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * Usuario que realizó la transacción
   */
  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
