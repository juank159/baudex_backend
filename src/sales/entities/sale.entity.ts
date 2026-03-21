import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { SaleItem } from './sale-item.entity';

export enum SaleStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  INVOICED = 'invoiced',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

export enum SaleType {
  REGULAR = 'regular',
  WHOLESALE = 'wholesale',
  RETAIL = 'retail',
  ONLINE = 'online',
  QUOTE = 'quote',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
}

/**
 * Entidad para gestión de ventas
 * Separada de invoices para permitir cotizaciones, ventas no facturadas, etc.
 */
@Entity('sales')
@Index(['organizationId', 'saleDate'])
@Index(['customerId', 'status'])
export class Sale extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  saleNumber: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  saleDate: Date;

  @Column({ type: 'date', nullable: true })
  deliveryDate?: Date;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.DRAFT,
  })
  status: SaleStatus;

  @Column({
    type: 'enum',
    enum: SaleType,
    default: SaleType.REGULAR,
  })
  type: SaleType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  // Totales
  // CRITICAL: transformer ensures TypeORM returns numbers, not strings (decimal columns)
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  taxPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  discountPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  total: number;

  // Costos para análisis de rentabilidad
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  totalCost: number; // Costo total de los productos vendidos (COGS)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  grossProfit: number; // Utilidad bruta

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  profitMargin: number; // Margen de utilidad

  // Información adicional
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  deliveryInstructions?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerReference?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relación con cliente
  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer)
  customer: Customer;

  // Usuario que creó la venta
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  createdBy: User;

  // Usuario que confirmó la venta
  @Column({ type: 'uuid', nullable: true })
  confirmedById?: string;

  @ManyToOne(() => User, { nullable: true })
  confirmedBy?: User;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt?: Date;

  // Relación con factura (opcional)
  @Column({ type: 'uuid', nullable: true })
  invoiceId?: string;

  @ManyToOne(() => Invoice, { nullable: true })
  invoice?: Invoice;

  // Items de la venta
  @OneToMany(() => SaleItem, (item) => item.sale, {
    cascade: true,
    eager: true,
  })
  items: SaleItem[];

  // Generar número de venta automáticamente
  @BeforeInsert()
  generateSaleNumber() {
    if (!this.saleNumber) {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-6);
      this.saleNumber = `SAL-${year}${month}-${timestamp}`;
    }
  }

  // Métodos útiles
  get isEditable(): boolean {
    return [SaleStatus.DRAFT, SaleStatus.PENDING].includes(this.status);
  }

  get canBeInvoiced(): boolean {
    return (
      [SaleStatus.CONFIRMED, SaleStatus.DELIVERED].includes(this.status) &&
      !this.invoiceId
    );
  }

  get isCompleted(): boolean {
    return [SaleStatus.DELIVERED, SaleStatus.INVOICED].includes(this.status);
  }

  get totalQuantity(): number {
    return this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  }

  get totalItems(): number {
    return this.items?.length || 0;
  }

  get averageItemValue(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.subtotal / this.items.length;
  }

  get profitMarginPercentage(): number {
    if (this.total === 0) return 0;
    return (this.grossProfit / this.total) * 100;
  }

  // Calcular totales y rentabilidad
  calculateTotals(): void {
    if (!this.items || this.items.length === 0) {
      this.subtotal = 0;
      this.totalCost = 0;
      this.taxAmount = 0;
      this.total = 0;
      this.grossProfit = 0;
      this.profitMargin = 0;
      return;
    }

    // Calcular subtotal y costo total
    this.subtotal = 0;
    this.totalCost = 0;

    this.items.forEach((item) => {
      this.subtotal += item.quantity * item.unitPrice;
      this.totalCost += item.quantity * item.unitCost;
    });

    // Aplicar descuento
    let discountAmount = this.discountAmount || 0;
    if (this.discountPercentage > 0) {
      discountAmount = (this.subtotal * this.discountPercentage) / 100;
      this.discountAmount = discountAmount;
    }

    const subtotalAfterDiscount = this.subtotal - discountAmount;

    // Calcular impuestos
    this.taxAmount = (subtotalAfterDiscount * (this.taxPercentage || 0)) / 100;

    // Calcular total
    this.total =
      subtotalAfterDiscount + this.taxAmount + (this.shippingCost || 0);

    // Calcular rentabilidad
    this.grossProfit = this.total - this.totalCost - (this.shippingCost || 0);
    this.profitMargin =
      this.total > 0 ? (this.grossProfit / this.total) * 100 : 0;

    // Redondear valores
    this.subtotal = Math.round(this.subtotal * 100) / 100;
    this.totalCost = Math.round(this.totalCost * 100) / 100;
    this.taxAmount = Math.round(this.taxAmount * 100) / 100;
    this.total = Math.round(this.total * 100) / 100;
    this.grossProfit = Math.round(this.grossProfit * 100) / 100;
    this.profitMargin = Math.round(this.profitMargin * 100) / 100;
    this.discountAmount = Math.round(this.discountAmount * 100) / 100;
  }

  // Confirmar venta
  confirm(userId: string): void {
    if (this.status !== SaleStatus.PENDING) return;

    this.status = SaleStatus.CONFIRMED;
    this.confirmedById = userId;
    this.confirmedAt = new Date();
  }

  // Marcar como entregada
  deliver(): void {
    if (this.status !== SaleStatus.CONFIRMED) return;

    this.status = SaleStatus.DELIVERED;
    this.deliveryDate = new Date();
  }

  // Vincular con factura
  linkToInvoice(invoiceId: string): void {
    this.invoiceId = invoiceId;
    this.status = SaleStatus.INVOICED;
  }
}
