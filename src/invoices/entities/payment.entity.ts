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

@Entity('payments')
export class Payment extends BaseEntity {
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

  // Usuario que creó el pago
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  createdBy: User;
}