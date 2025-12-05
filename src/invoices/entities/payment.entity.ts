import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Invoice, PaymentMethod } from './invoice.entity';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { BankAccount } from '../../bank-accounts/entities/bank-account.entity';

@Entity('payments')
@Index('IDX_payments_invoice_organization', ['invoiceId', 'organizationId'])
@Index('IDX_payments_bank_account', ['bankAccountId'])
export class Payment extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  paymentNumber: string;

  @Column({
    type: 'float',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method_enum',
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  paymentDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relación con factura
  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments, { onDelete: 'CASCADE' })
  invoice: Invoice;

  // Relación con cuenta bancaria (opcional - para saber a qué cuenta fue el pago)
  @Column({ type: 'uuid', name: 'bank_account_id', nullable: true })
  bankAccountId?: string;

  @ManyToOne(() => BankAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount?: BankAccount;

  // Usuario que creó el pago
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  createdBy: User;
}