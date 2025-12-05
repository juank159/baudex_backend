// src/customer-credits/entities/credit-payment.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CustomerCredit } from './customer-credit.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { BankAccount } from '../../bank-accounts/entities/bank-account.entity';

/**
 * Entidad de Pago a Crédito (Abono)
 * Representa un abono realizado a un crédito de cliente
 */
@Entity('credit_payments')
@Index('IDX_credit_payments_credit', ['creditId'])
@Index('IDX_credit_payments_organization', ['organizationId'])
@Index('IDX_credit_payments_payment_date', ['paymentDate'])
export class CreditPayment extends BaseEntity {
  /**
   * Monto del abono
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
   * Método de pago (cash, bank_transfer, credit_card, debit_card, nequi, daviplata, etc.)
   */
  @Column({ name: 'payment_method', type: 'varchar', length: 50 })
  paymentMethod: string;

  /**
   * Fecha del pago
   */
  @Column({ name: 'payment_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  paymentDate: Date;

  /**
   * Referencia del pago (número de transacción, etc.)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string;

  /**
   * Notas del pago
   */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  // ==================== RELACIONES ====================

  /**
   * Crédito al que pertenece el pago
   */
  @Column({ type: 'uuid', name: 'credit_id' })
  creditId: string;

  @ManyToOne(() => CustomerCredit, (credit) => credit.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'credit_id' })
  credit: CustomerCredit;

  /**
   * Cuenta bancaria donde se recibió el pago (opcional)
   */
  @Column({ type: 'uuid', name: 'bank_account_id', nullable: true })
  bankAccountId?: string;

  @ManyToOne(() => BankAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount?: BankAccount;

  /**
   * Organización (multitenant)
   */
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * Usuario que registró el pago
   */
  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;
}
