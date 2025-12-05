// src/customer-credits/entities/client-balance.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { ClientBalanceTransaction } from './client-balance-transaction.entity';

/**
 * Saldo a favor del cliente
 * - Positivo: Cliente tiene saldo a favor (la tienda le debe)
 * - Cero: Sin saldo
 * - Nota: No permitimos saldo negativo (las deudas se manejan con CustomerCredits)
 */
@Entity('client_balances')
@Index('IDX_client_balances_customer', ['customerId'], { unique: true })
@Index('IDX_client_balances_organization', ['organizationId'])
export class ClientBalance extends BaseEntity {
  /**
   * Saldo actual a favor del cliente
   */
  @Column({
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
  balance: number;

  // ==================== RELACIONES ====================

  /**
   * Cliente dueño del saldo
   */
  @Column({ type: 'uuid', name: 'customer_id', unique: true })
  customerId: string;

  @OneToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  /**
   * Organización (multitenant)
   */
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * Usuario que creó el registro
   */
  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  /**
   * Historial de transacciones del saldo
   */
  @OneToMany(() => ClientBalanceTransaction, (transaction) => transaction.clientBalance, {
    cascade: true,
  })
  transactions: ClientBalanceTransaction[];
}
