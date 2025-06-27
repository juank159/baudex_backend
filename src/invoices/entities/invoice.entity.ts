// import {
//   Entity,
//   Column,
//   ManyToOne,
//   OneToMany,
//   JoinColumn,
//   BeforeInsert,
// } from 'typeorm';
// import { BaseEntity } from '../../common/entities/base.entity';
// import { Customer } from '../../customers/entities/customer.entity';
// import { User } from '../../users/entities/user.entity';
// import { InvoiceItem } from './invoice-item.entity';

// export enum InvoiceStatus {
//   DRAFT = 'draft',
//   PENDING = 'pending',
//   PAID = 'paid',
//   OVERDUE = 'overdue',
//   CANCELLED = 'cancelled',
//   PARTIALLY_PAID = 'partially_paid',
// }

// export enum PaymentMethod {
//   CASH = 'cash',
//   CREDIT_CARD = 'credit_card',
//   DEBIT_CARD = 'debit_card',
//   BANK_TRANSFER = 'bank_transfer',
//   CHECK = 'check',
//   CREDIT = 'credit',
//   OTHER = 'other',
// }

// @Entity('invoices')
// export class Invoice extends BaseEntity {
//   @Column({ type: 'varchar', length: 50, unique: true })
//   number: string;

//   @Column({ type: 'date' })
//   date: Date;

//   @Column({ type: 'date' })
//   dueDate: Date;

//   @Column({
//     type: 'enum',
//     enum: InvoiceStatus,
//     default: InvoiceStatus.DRAFT,
//   })
//   status: InvoiceStatus;

//   @Column({
//     type: 'enum',
//     enum: PaymentMethod,
//     default: PaymentMethod.CASH,
//   })
//   paymentMethod: PaymentMethod;

//   // ✅ CAMPOS NUMÉRICOS CORREGIDOS - USAR 'float' EN LUGAR DE 'decimal'
//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   subtotal: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   taxPercentage: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   taxAmount: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   discountPercentage: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   discountAmount: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   total: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   paidAmount: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   balanceDue: number;

//   // Información adicional
//   @Column({ type: 'text', nullable: true })
//   notes?: string;

//   @Column({ type: 'text', nullable: true })
//   terms?: string;

//   @Column({ type: 'json', nullable: true })
//   metadata?: Record<string, any>;

//   // Relaciones
//   @Column({ type: 'uuid' })
//   customerId: string;

//   @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
//   @JoinColumn({ name: 'customer_id' })
//   customer: Customer;

//   @Column({ type: 'uuid' })
//   createdById: string;

//   @ManyToOne(() => User, { onDelete: 'RESTRICT' })
//   @JoinColumn({ name: 'created_by_id' })
//   createdBy: User;

//   @OneToMany(() => InvoiceItem, (item) => item.invoice, {
//     cascade: true,
//     eager: true,
//   })
//   items: InvoiceItem[];

//   // Métodos útiles
//   get isOverdue(): boolean {
//     return new Date() > this.dueDate && this.status !== InvoiceStatus.PAID;
//   }

//   get isPaid(): boolean {
//     return this.status === InvoiceStatus.PAID || this.balanceDue <= 0;
//   }

//   get isPartiallyPaid(): boolean {
//     return this.paidAmount > 0 && this.paidAmount < this.total;
//   }

//   get daysOverdue(): number {
//     if (!this.isOverdue) return 0;
//     const diffTime = new Date().getTime() - this.dueDate.getTime();
//     return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
//   }

//   // Generar número de factura automáticamente
//   @BeforeInsert()
//   generateInvoiceNumber() {
//     if (!this.number) {
//       const year = new Date().getFullYear();
//       const timestamp = Date.now().toString().slice(-6);
//       this.number = `INV-${year}-${timestamp}`;
//     }
//   }

//   // ✅ MÉTODO DE CÁLCULO DE TOTALES CORREGIDO Y SIMPLIFICADO
//   calculateTotals(): void {
//     console.log('🧮 Calculando totales para factura:', this.id);

//     // Asegurar que items existe y convertir a número
//     if (!this.items || this.items.length === 0) {
//       this.subtotal = 0;
//       this.taxAmount = 0;
//       this.total = 0;
//       this.balanceDue = 0;
//       console.log('⚠️ No hay items, totales en 0');
//       return;
//     }

//     // ✅ CALCULAR SUBTOTAL CON CONVERSIÓN SEGURA
//     this.subtotal = this.items.reduce((sum, item) => {
//       const itemSubtotal = Number(item.subtotal) || 0;
//       console.log(`📊 Item: ${item.description}, Subtotal: ${itemSubtotal}`);
//       return sum + itemSubtotal;
//     }, 0);

//     console.log(`💰 Subtotal calculado: ${this.subtotal}`);

//     // ✅ APLICAR DESCUENTO CON CONVERSIÓN SEGURA
//     const discountPercentage = Number(this.discountPercentage) || 0;
//     let discountAmount = Number(this.discountAmount) || 0;

//     if (discountPercentage > 0) {
//       discountAmount = (this.subtotal * discountPercentage) / 100;
//       this.discountAmount = Math.round(discountAmount * 100) / 100;
//     }

//     const subtotalAfterDiscount = this.subtotal - discountAmount;
//     console.log(`💸 Subtotal después de descuento: ${subtotalAfterDiscount}`);

//     // ✅ CALCULAR IMPUESTOS CON CONVERSIÓN SEGURA
//     const taxPercentage = Number(this.taxPercentage) || 0;
//     this.taxAmount =
//       Math.round(((subtotalAfterDiscount * taxPercentage) / 100) * 100) / 100;
//     console.log(`🏛️ Impuestos calculados: ${this.taxAmount}`);

//     // ✅ CALCULAR TOTAL FINAL
//     this.total =
//       Math.round((subtotalAfterDiscount + this.taxAmount) * 100) / 100;

//     // ✅ CALCULAR BALANCE PENDIENTE
//     const paidAmount = Number(this.paidAmount) || 0;
//     this.balanceDue = Math.round((this.total - paidAmount) * 100) / 100;

//     console.log(`🎯 Total final: ${this.total}`);
//     console.log(`💳 Balance pendiente: ${this.balanceDue}`);

//     // ✅ ASEGURAR QUE TODOS LOS VALORES SEAN NÚMEROS VÁLIDOS
//     this.subtotal = Number(this.subtotal) || 0;
//     this.taxAmount = Number(this.taxAmount) || 0;
//     this.total = Number(this.total) || 0;
//     this.balanceDue = Number(this.balanceDue) || 0;
//     this.discountAmount = Number(this.discountAmount) || 0;
//   }
// }

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

  // ✅ CAMPOS NUMÉRICOS CORREGIDOS
  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  subtotal: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  taxPercentage: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  taxAmount: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  discountPercentage: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  discountAmount: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  total: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  paidAmount: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  balanceDue: number;

  // Información adicional
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // ✅ RELACIONES CORREGIDAS - ESTE ES EL FIX PRINCIPAL
  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' }) // ✅ CORREGIDO: usar 'customerId' no 'customer_id'
  customer: Customer;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' }) // ✅ CORREGIDO: usar 'createdById' no 'created_by_id'
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

  // ✅ MÉTODO DE CÁLCULO DE TOTALES CORREGIDO
  calculateTotals(): void {
    console.log('🧮 Calculando totales para factura:', this.id);

    if (!this.items || this.items.length === 0) {
      this.subtotal = 0;
      this.taxAmount = 0;
      this.total = 0;
      this.balanceDue = 0;
      console.log('⚠️ No hay items, totales en 0');
      return;
    }

    // ✅ CALCULAR SUBTOTAL CON CONVERSIÓN SEGURA
    this.subtotal = this.items.reduce((sum, item) => {
      const itemSubtotal = Number(item.subtotal) || 0;
      console.log(`📊 Item: ${item.description}, Subtotal: ${itemSubtotal}`);
      return sum + itemSubtotal;
    }, 0);

    console.log(`💰 Subtotal calculado: ${this.subtotal}`);

    // ✅ APLICAR DESCUENTO CON CONVERSIÓN SEGURA
    const discountPercentage = Number(this.discountPercentage) || 0;
    let discountAmount = Number(this.discountAmount) || 0;

    if (discountPercentage > 0) {
      discountAmount = (this.subtotal * discountPercentage) / 100;
      this.discountAmount = Math.round(discountAmount * 100) / 100;
    }

    const subtotalAfterDiscount = this.subtotal - discountAmount;
    console.log(`💸 Subtotal después de descuento: ${subtotalAfterDiscount}`);

    // ✅ CALCULAR IMPUESTOS CON CONVERSIÓN SEGURA
    const taxPercentage = Number(this.taxPercentage) || 0;
    this.taxAmount =
      Math.round(((subtotalAfterDiscount * taxPercentage) / 100) * 100) / 100;
    console.log(`🏛️ Impuestos calculados: ${this.taxAmount}`);

    // ✅ CALCULAR TOTAL FINAL
    this.total =
      Math.round((subtotalAfterDiscount + this.taxAmount) * 100) / 100;

    // ✅ CALCULAR BALANCE PENDIENTE
    const paidAmount = Number(this.paidAmount) || 0;
    this.balanceDue = Math.round((this.total - paidAmount) * 100) / 100;

    console.log(`🎯 Total final: ${this.total}`);
    console.log(`💳 Balance pendiente: ${this.balanceDue}`);

    // ✅ ASEGURAR QUE TODOS LOS VALORES SEAN NÚMEROS VÁLIDOS
    this.subtotal = Number(this.subtotal) || 0;
    this.taxAmount = Number(this.taxAmount) || 0;
    this.total = Number(this.total) || 0;
    this.balanceDue = Number(this.balanceDue) || 0;
    this.discountAmount = Number(this.discountAmount) || 0;
  }
}
