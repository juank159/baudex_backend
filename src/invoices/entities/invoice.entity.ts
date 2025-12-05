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
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';
import { CreditNote } from '../../credit-notes/entities/credit-note.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  PARTIALLY_PAID = 'partially_paid',
  // Estados para notas de crédito
  CREDITED = 'credited', // Factura totalmente acreditada (anulada por NC)
  PARTIALLY_CREDITED = 'partially_credited', // Factura con NC parcial aplicada
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  CREDIT = 'credit',
  CLIENT_BALANCE = 'client_balance', // Pago con saldo a favor del cliente
  OTHER = 'other',
}

@Entity('invoices')
@Index('IDX_invoices_organization_number_unique', ['organizationId', 'number'], { unique: true })
@Index('IDX_invoices_date', ['date'])
@Index('IDX_invoices_dueDate', ['dueDate'])
@Index('IDX_invoices_status', ['status'])
@Index('IDX_invoices_customerId', ['customerId'])
@Index('IDX_invoices_organizationId_date', ['organizationId', 'date'])
@Index('IDX_invoices_organizationId_status', ['organizationId', 'status'])
export class Invoice extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
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

  // Campo para notas de crédito aplicadas
  @Column({
    name: 'credited_amount', // Nombre de columna en snake_case
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  creditedAmount: number; // Total acreditado por notas de crédito

  // 💰 NUEVO: Saldo a favor del cliente aplicado a esta factura
  @Column({
    name: 'client_balance_applied',
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  clientBalanceApplied: number; // Saldo a favor del cliente aplicado

  // Información adicional
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.invoices)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relaciones
  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  customer: Customer;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  createdBy: User;

  // ✅ PERFORMANCE FIX: Removed eager loading to avoid loading all items in list queries
  // Items should be explicitly loaded with relations: ['items'] when needed
  @OneToMany(() => InvoiceItem, (item) => item.invoice, {
    cascade: true,
  })
  items: InvoiceItem[];

  @OneToMany(() => Payment, (payment) => payment.invoice, {
    cascade: true,
  })
  payments: Payment[];

  // Notas de crédito aplicadas a esta factura
  @OneToMany(() => CreditNote, (creditNote) => creditNote.invoice)
  creditNotes: CreditNote[];

  // Métodos útiles

  /**
   * Verifica si la factura está vencida
   * Reglas de negocio:
   * - NUNCA está vencida si: paid, draft, cancelled, credited
   * - NUNCA está vencida si balanceDue <= 0
   * - NUNCA está vencida si es pago parcial y dueDate == fecha creación (legacy fix)
   * - SÍ puede estar vencida si: pending o partially_paid Y pasó la fecha
   * - Compara solo fechas (sin horas) para evitar falsos positivos
   */
  get isOverdue(): boolean {
    // Estados que NUNCA pueden estar vencidos
    if (
      this.status === InvoiceStatus.PAID ||
      this.status === InvoiceStatus.DRAFT ||
      this.status === InvoiceStatus.CANCELLED ||
      this.status === InvoiceStatus.CREDITED
    ) {
      return false;
    }

    // No hay saldo pendiente = no puede estar vencida
    if (this.balanceDue <= 0) {
      return false;
    }

    // Comparar solo fechas (sin horas) para evitar falsos positivos
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(
      this.dueDate.getFullYear(),
      this.dueDate.getMonth(),
      this.dueDate.getDate(),
    );
    const invoiceDateOnly = new Date(
      this.date.getFullYear(),
      this.date.getMonth(),
      this.date.getDate(),
    );

    // 📅 LEGACY FIX: Facturas con pago parcial donde dueDate == fecha de creación
    // Estas facturas tienen datos incorrectos de versiones anteriores
    // Les damos un plazo implícito de 30 días desde su creación
    if (
      this.status === InvoiceStatus.PARTIALLY_PAID &&
      dueDateOnly.getTime() === invoiceDateOnly.getTime()
    ) {
      // Calcular fecha de vencimiento implícita (30 días desde creación)
      const implicitDueDate = new Date(invoiceDateOnly);
      implicitDueDate.setDate(implicitDueDate.getDate() + 30);

      // Vencida solo si hoy es DESPUÉS de la fecha implícita
      return today > implicitDueDate;
    }

    // Vencida solo si hoy es DESPUÉS de la fecha de vencimiento
    // (no el mismo día, sino días posteriores)
    return today > dueDateOnly;
  }

  get isPaid(): boolean {
    return this.status === InvoiceStatus.PAID || this.balanceDue <= 0;
  }

  get isPartiallyPaid(): boolean {
    return this.paidAmount > 0 && this.paidAmount < this.total;
  }

  /**
   * Días de vencimiento (solo si está vencida)
   * Retorna días completos transcurridos desde la fecha de vencimiento
   */
  get daysOverdue(): number {
    if (!this.isOverdue) return 0;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(
      this.dueDate.getFullYear(),
      this.dueDate.getMonth(),
      this.dueDate.getDate(),
    );
    const invoiceDateOnly = new Date(
      this.date.getFullYear(),
      this.date.getMonth(),
      this.date.getDate(),
    );

    // 📅 LEGACY FIX: Facturas con pago parcial donde dueDate == fecha de creación
    // Usar fecha implícita de 30 días
    let effectiveDueDate = dueDateOnly;
    if (
      this.status === InvoiceStatus.PARTIALLY_PAID &&
      dueDateOnly.getTime() === invoiceDateOnly.getTime()
    ) {
      effectiveDueDate = new Date(invoiceDateOnly);
      effectiveDueDate.setDate(effectiveDueDate.getDate() + 30);
    }

    const diffTime = today.getTime() - effectiveDueDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * Días restantes hasta el vencimiento (si aún no está vencida)
   * Retorna 0 si ya está vencida o pagada
   */
  get daysUntilDue(): number {
    if (this.isOverdue || this.isPaid) return 0;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(
      this.dueDate.getFullYear(),
      this.dueDate.getMonth(),
      this.dueDate.getDate(),
    );
    const invoiceDateOnly = new Date(
      this.date.getFullYear(),
      this.date.getMonth(),
      this.date.getDate(),
    );

    // 📅 LEGACY FIX: Facturas con pago parcial donde dueDate == fecha de creación
    // Usar fecha implícita de 30 días
    let effectiveDueDate = dueDateOnly;
    if (
      this.status === InvoiceStatus.PARTIALLY_PAID &&
      dueDateOnly.getTime() === invoiceDateOnly.getTime()
    ) {
      effectiveDueDate = new Date(invoiceDateOnly);
      effectiveDueDate.setDate(effectiveDueDate.getDate() + 30);
    }

    const diffTime = effectiveDueDate.getTime() - today.getTime();
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  }

  /**
   * Indica si la factura vence pronto (dentro de 3 días)
   */
  get isDueSoon(): boolean {
    if (this.isOverdue || this.isPaid) return false;
    return this.daysUntilDue > 0 && this.daysUntilDue <= 3;
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

  // ✅ MÉTODO DE CÁLCULO DE TOTALES CORREGIDO - CALCULA IVA POR ITEM
  calculateTotals(): void {
    console.log('🧮 Calculando totales para factura:', this.id);

    if (!this.items || this.items.length === 0) {
      this.subtotal = 0;
      this.taxAmount = 0;
      this.taxPercentage = 0;
      this.total = 0;
      this.balanceDue = 0;
      console.log('⚠️ No hay items, totales en 0');
      return;
    }

    // ✅ CALCULAR SUBTOTAL Y TAX AMOUNT POR CADA ITEM INDIVIDUALMENTE
    let totalSubtotal = 0;
    let totalTaxAmount = 0;

    this.items.forEach((item) => {
      const itemSubtotal = Number(item.subtotal) || 0;
      const itemTaxRate = Number(item.taxPercentage) || 0;
      const itemTaxAmount = (itemSubtotal * itemTaxRate) / 100;

      totalSubtotal += itemSubtotal;
      totalTaxAmount += itemTaxAmount;

      console.log(
        `📊 Item: ${item.description}, Subtotal: ${itemSubtotal.toFixed(2)}, IVA ${itemTaxRate}%: ${itemTaxAmount.toFixed(2)}`,
      );
    });

    this.subtotal = Math.round(totalSubtotal * 100) / 100;
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

    // ✅ AJUSTAR EL IMPUESTO PROPORCIONAL AL DESCUENTO
    if (discountAmount > 0 && this.subtotal > 0) {
      const discountRatio = subtotalAfterDiscount / this.subtotal;
      this.taxAmount = Math.round(totalTaxAmount * discountRatio * 100) / 100;
    } else {
      this.taxAmount = Math.round(totalTaxAmount * 100) / 100;
    }
    console.log(`🏛️ Impuestos totales: ${this.taxAmount}`);

    // ✅ CALCULAR TAX PERCENTAGE PROMEDIO PONDERADO (para mostrar)
    if (subtotalAfterDiscount > 0) {
      this.taxPercentage = Math.round((this.taxAmount / subtotalAfterDiscount) * 100 * 100) / 100;
    } else {
      this.taxPercentage = 0;
    }
    console.log(`📈 IVA promedio: ${this.taxPercentage}%`);

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
    this.taxPercentage = Number(this.taxPercentage) || 0;
    this.total = Number(this.total) || 0;
    this.balanceDue = Number(this.balanceDue) || 0;
    this.discountAmount = Number(this.discountAmount) || 0;
  }
}
