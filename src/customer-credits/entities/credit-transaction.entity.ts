// src/customer-credits/entities/credit-transaction.entity.ts
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
import { CustomerCredit } from './customer-credit.entity';
import { BankAccount } from '../../bank-accounts/entities/bank-account.entity';

/**
 * Tipo de transacción de crédito
 */
export enum CreditTransactionType {
  CHARGE = 'charge',              // Cargo inicial del crédito
  DEBT_INCREASE = 'debt_increase', // Aumento de deuda
  PAYMENT = 'payment',            // Pago/Abono
  BALANCE_USED = 'balance_used',  // Uso de saldo a favor
  BALANCE_GENERATED = 'balance_generated', // Saldo a favor generado por sobrepago
}

/**
 * Transacción de crédito
 * Registra el historial completo de un crédito: cargos, aumentos, pagos
 */
@Entity('credit_transactions')
@Index('IDX_credit_transactions_credit', ['creditId'])
@Index('IDX_credit_transactions_type', ['type'])
@Index('IDX_credit_transactions_organization', ['organizationId'])
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tipo de transacción
   */
  @Column({
    type: 'enum',
    enum: CreditTransactionType,
  })
  type: CreditTransactionType;

  /**
   * Monto de la transacción
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
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Saldo pendiente después de esta transacción
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
   * Método de pago (solo para pagos)
   */
  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  /**
   * Cuenta bancaria usada para el pago (opcional)
   */
  @Column({ type: 'uuid', name: 'bank_account_id', nullable: true })
  bankAccountId?: string;

  @ManyToOne(() => BankAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount?: BankAccount;

  // ==================== RELACIONES ====================

  /**
   * Crédito al que pertenece la transacción
   */
  @Column({ type: 'uuid', name: 'credit_id' })
  creditId: string;

  @ManyToOne(() => CustomerCredit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'credit_id' })
  credit: CustomerCredit;

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
