// src/bank-accounts/entities/bank-account.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Transform } from 'class-transformer';

export enum BankAccountType {
  CASH = 'cash',                     // Efectivo
  SAVINGS = 'savings',               // Cuenta de ahorros
  CHECKING = 'checking',             // Cuenta corriente
  DIGITAL_WALLET = 'digital_wallet', // Billetera digital (Nequi, Daviplata, Movii)
  CREDIT_CARD = 'credit_card',       // Tarjeta de crédito
  DEBIT_CARD = 'debit_card',         // Tarjeta de débito
  OTHER = 'other',                   // Otro
}

@Entity('bank_accounts')
@Index('IDX_bank_accounts_organization', ['organizationId'])
@Index('IDX_bank_accounts_active', ['organizationId', 'isActive'])
export class BankAccount extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string; // Nombre descriptivo: "Nequi Principal", "Bancolombia Ahorros"

  @Column({
    type: 'enum',
    enum: BankAccountType,
    default: BankAccountType.CASH,
  })
  type: BankAccountType;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bank_name' })
  bankName?: string; // Nombre del banco: "Bancolombia", "Nequi", "Daviplata"

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'account_number' })
  accountNumber?: string; // Número de cuenta (puede ser parcialmente oculto)

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'holder_name' })
  holderName?: string; // Nombre del titular de la cuenta

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string; // Nombre del icono para la UI: 'money', 'credit_card', 'phone_android'

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault: boolean; // Cuenta predeterminada para el tenant

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number; // Orden de visualización

  @Column({ type: 'text', nullable: true })
  description?: string; // Descripción o notas adicionales

  // Saldo actual de la cuenta (acumulado de todos los pagos recibidos)
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'current_balance',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  currentBalance: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>; // Datos adicionales flexibles

  // Relación multi-tenant
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Campos de auditoría
  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById?: string;

  @Column({ type: 'uuid', name: 'updated_by_id', nullable: true })
  updatedById?: string;

  // Getters útiles
  get displayName(): string {
    if (this.bankName) {
      return `${this.name} (${this.bankName})`;
    }
    return this.name;
  }

  get maskedAccountNumber(): string {
    if (!this.accountNumber) return '';
    if (this.accountNumber.length <= 4) return this.accountNumber;
    return '****' + this.accountNumber.slice(-4);
  }

  get typeDisplayName(): string {
    const typeNames: Record<BankAccountType, string> = {
      [BankAccountType.CASH]: 'Efectivo',
      [BankAccountType.SAVINGS]: 'Cuenta de Ahorros',
      [BankAccountType.CHECKING]: 'Cuenta Corriente',
      [BankAccountType.DIGITAL_WALLET]: 'Billetera Digital',
      [BankAccountType.CREDIT_CARD]: 'Tarjeta de Crédito',
      [BankAccountType.DEBIT_CARD]: 'Tarjeta de Débito',
      [BankAccountType.OTHER]: 'Otro',
    };
    return typeNames[this.type] || this.type;
  }
}
