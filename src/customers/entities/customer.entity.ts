// // src/modules/customers/entities/customer.entity.ts - ACTUALIZADA
// import { Entity, Column, OneToMany } from 'typeorm';
// import { BaseEntity } from '../../common/entities/base.entity';
// import { Invoice } from '../../invoices/entities/invoice.entity'; // 👈 AGREGAR IMPORT

// export enum CustomerStatus {
//   ACTIVE = 'active',
//   INACTIVE = 'inactive',
//   SUSPENDED = 'suspended',
// }

// export enum DocumentType {
//   CC = 'cc', // Cédula de ciudadanía
//   NIT = 'nit', // Número de identificación tributaria
//   CE = 'ce', // Cédula de extranjería
//   PASSPORT = 'passport', // Pasaporte
//   OTHER = 'other', // Otro
// }

// @Entity('customers')
// export class Customer extends BaseEntity {
//   @Column({ type: 'varchar', length: 100 })
//   firstName: string;

//   @Column({ type: 'varchar', length: 100 })
//   lastName: string;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   companyName?: string;

//   @Column({ type: 'varchar', length: 255, unique: true })
//   email: string;

//   @Column({ type: 'varchar', length: 20, nullable: true })
//   phone?: string;

//   @Column({ type: 'varchar', length: 20, nullable: true })
//   mobile?: string;

//   @Column({
//     type: 'enum',
//     enum: DocumentType,
//     default: DocumentType.CC,
//   })
//   documentType: DocumentType;

//   @Column({ type: 'varchar', length: 50, unique: true })
//   documentNumber: string;

//   @Column({ type: 'text', nullable: true })
//   address?: string;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   city?: string;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   state?: string;

//   @Column({ type: 'varchar', length: 20, nullable: true })
//   zipCode?: string;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   country?: string;

//   @Column({
//     type: 'enum',
//     enum: CustomerStatus,
//     default: CustomerStatus.ACTIVE,
//   })
//   status: CustomerStatus;

//   // Información financiera
//   @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
//   creditLimit: number;

//   @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
//   currentBalance: number;

//   @Column({ type: 'integer', default: 30 })
//   paymentTerms: number; // Días para pago

//   // Información adicional
//   @Column({ type: 'date', nullable: true })
//   birthDate?: Date;

//   @Column({ type: 'text', nullable: true })
//   notes?: string;

//   @Column({ type: 'json', nullable: true })
//   metadata?: Record<string, any>;

//   // Campos calculados
//   @Column({ type: 'timestamp', nullable: true })
//   lastPurchaseAt?: Date;

//   @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
//   totalPurchases: number;

//   @Column({ type: 'integer', default: 0 })
//   totalOrders: number;

//   // 🆕 RELACIÓN ACTIVADA
//   @OneToMany(() => Invoice, (invoice) => invoice.customer)
//   invoices: Invoice[];

//   // Métodos útiles
//   get fullName(): string {
//     return `${this.firstName} ${this.lastName}`;
//   }

//   get displayName(): string {
//     return this.companyName || this.fullName;
//   }

//   get isActive(): boolean {
//     return this.status === CustomerStatus.ACTIVE && !this.deletedAt;
//   }

//   get availableCredit(): number {
//     return Math.max(0, this.creditLimit - this.currentBalance);
//   }

//   get isWithinCreditLimit(): boolean {
//     return this.currentBalance <= this.creditLimit;
//   }

//   get formattedDocument(): string {
//     return `${this.documentType.toUpperCase()}: ${this.documentNumber}`;
//   }

//   // 🆕 MÉTODOS ADICIONALES CON FACTURAS
//   get hasInvoices(): boolean {
//     return this.invoices && this.invoices.length > 0;
//   }

//   get totalInvoices(): number {
//     return this.invoices ? this.invoices.length : this.totalOrders;
//   }

//   get totalSales(): number {
//     if (!this.invoices) return this.totalPurchases;
//     return this.invoices
//       .filter(
//         (invoice) =>
//           invoice.status === 'paid' || invoice.status === 'partially_paid',
//       )
//       .reduce((sum, invoice) => sum + invoice.total, 0);
//   }

//   get pendingInvoicesAmount(): number {
//     if (!this.invoices) return this.currentBalance;
//     return this.invoices
//       .filter(
//         (invoice) =>
//           invoice.status === 'pending' || invoice.status === 'partially_paid',
//       )
//       .reduce((sum, invoice) => sum + invoice.balanceDue, 0);
//   }

//   get overdueInvoicesCount(): number {
//     if (!this.invoices) return 0;
//     return this.invoices.filter((invoice) => invoice.isOverdue).length;
//   }

//   get averageInvoiceAmount(): number {
//     if (!this.invoices || this.invoices.length === 0) return 0;
//     const totalAmount = this.invoices.reduce(
//       (sum, invoice) => sum + invoice.total,
//       0,
//     );
//     return totalAmount / this.invoices.length;
//   }

//   get lastInvoiceDate(): Date | null {
//     if (!this.invoices || this.invoices.length === 0)
//       return this.lastPurchaseAt || null;
//     return (
//       this.invoices.sort(
//         (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
//       )[0]?.date || null
//     );
//   }

//   get customerRisk(): 'low' | 'medium' | 'high' {
//     const overdueCount = this.overdueInvoicesCount;
//     const balanceRatio =
//       this.creditLimit > 0 ? this.currentBalance / this.creditLimit : 0;

//     if (overdueCount >= 3 || balanceRatio > 0.9) return 'high';
//     if (overdueCount >= 1 || balanceRatio > 0.7) return 'medium';
//     return 'low';
//   }
// }

// src/modules/customers/entities/customer.entity.ts - ACTUALIZADA
import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Transform } from 'class-transformer';

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum DocumentType {
  CC = 'cc',
  NIT = 'nit',
  CE = 'ce',
  PASSPORT = 'passport',
  OTHER = 'other',
}

@Entity('customers')
export class Customer extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  companyName?: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile?: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.CC,
  })
  documentType: DocumentType;

  @Column({ type: 'varchar', length: 50, unique: true })
  documentNumber: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  zipCode?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.customers)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // ✅ ARREGLO: Configurar transformación para campos decimales
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Transform(({ value }) => parseFloat(value), { toPlainOnly: true })
  creditLimit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Transform(({ value }) => parseFloat(value), { toPlainOnly: true })
  currentBalance: number;

  @Column({ type: 'integer', default: 30 })
  paymentTerms: number;

  @Column({ type: 'date', nullable: true })
  birthDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  lastPurchaseAt?: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  @Transform(({ value }) => parseFloat(value), { toPlainOnly: true })
  totalPurchases: number;

  @Column({ type: 'integer', default: 0 })
  totalOrders: number;

  @OneToMany(() => Invoice, (invoice) => invoice.customer)
  invoices: Invoice[];

  // Métodos útiles
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get displayName(): string {
    return this.companyName || this.fullName;
  }

  get isActive(): boolean {
    return this.status === CustomerStatus.ACTIVE && !this.deletedAt;
  }

  get availableCredit(): number {
    return Math.max(0, this.creditLimit - this.currentBalance);
  }

  get isWithinCreditLimit(): boolean {
    return this.currentBalance <= this.creditLimit;
  }

  get formattedDocument(): string {
    return `${this.documentType.toUpperCase()}: ${this.documentNumber}`;
  }

  // Métodos adicionales con facturas
  get hasInvoices(): boolean {
    return this.invoices && this.invoices.length > 0;
  }

  get totalInvoices(): number {
    return this.invoices ? this.invoices.length : this.totalOrders;
  }

  get totalSales(): number {
    if (!this.invoices) return this.totalPurchases;
    return this.invoices
      .filter(
        (invoice) =>
          invoice.status === 'paid' || invoice.status === 'partially_paid',
      )
      .reduce((sum, invoice) => sum + invoice.total, 0);
  }

  get pendingInvoicesAmount(): number {
    if (!this.invoices) return this.currentBalance;
    return this.invoices
      .filter(
        (invoice) =>
          invoice.status === 'pending' || invoice.status === 'partially_paid',
      )
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  }

  get overdueInvoicesCount(): number {
    if (!this.invoices) return 0;
    return this.invoices.filter((invoice) => invoice.isOverdue).length;
  }

  get averageInvoiceAmount(): number {
    if (!this.invoices || this.invoices.length === 0) return 0;
    const totalAmount = this.invoices.reduce(
      (sum, invoice) => sum + invoice.total,
      0,
    );
    return totalAmount / this.invoices.length;
  }

  get lastInvoiceDate(): Date | null {
    if (!this.invoices || this.invoices.length === 0)
      return this.lastPurchaseAt || null;
    return (
      this.invoices.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0]?.date || null
    );
  }

  get customerRisk(): 'low' | 'medium' | 'high' {
    const overdueCount = this.overdueInvoicesCount;
    const balanceRatio =
      this.creditLimit > 0 ? this.currentBalance / this.creditLimit : 0;

    if (overdueCount >= 3 || balanceRatio > 0.9) return 'high';
    if (overdueCount >= 1 || balanceRatio > 0.7) return 'medium';
    return 'low';
  }
}
