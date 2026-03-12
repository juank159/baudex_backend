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
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { InventoryBatch } from './inventory-batch.entity';

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  SENT = 'sent',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

@Entity('purchase_orders')
@Index(['organizationId', 'orderDate'])
export class PurchaseOrder extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true, name: 'poNumber' })
  orderNumber: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP', name: 'date' })
  @Index()
  orderDate: Date;

  @Column({ type: 'date', nullable: true })
  expectedDeliveryDate?: Date;

  @Column({ type: 'date', nullable: true })
  actualDeliveryDate?: Date;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  // Totales
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    nullable: true,
  })
  taxPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    nullable: true,
  })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  // Información adicional
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relación con almacén de destino
  @Column({ type: 'uuid', nullable: true })
  warehouseId?: string;

  @ManyToOne('Warehouse')
  warehouse?: any;

  // Relación con proveedor
  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders)
  supplier: Supplier;

  // Usuario que creó la orden
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  createdBy: User;

  // Usuario que aprobó la orden
  @Column({ type: 'uuid', nullable: true })
  approvedById?: string;

  @ManyToOne(() => User, { nullable: true })
  approvedBy?: User;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  // Usuario que recibió la orden
  @Column({ type: 'uuid', nullable: true })
  receivedById?: string;

  @ManyToOne(() => User, { nullable: true })
  receivedBy?: User;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt?: Date;

  // Items de la orden
  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
    eager: true,
  })
  items: PurchaseOrderItem[];

  // Lotes generados por esta orden
  @OneToMany(() => InventoryBatch, (batch) => batch.purchaseOrder)
  batches: InventoryBatch[];

  // Generar número de orden automáticamente
  @BeforeInsert()
  generateOrderNumber() {
    if (!this.orderNumber) {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-6);
      this.orderNumber = `PO-${year}${month}-${timestamp}`;
    }
  }

  // Métodos útiles
  get isEditable(): boolean {
    return [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.PENDING].includes(
      this.status,
    );
  }

  get canBeReceived(): boolean {
    return [
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ].includes(this.status);
  }

  get totalQuantityOrdered(): number {
    return this.items?.reduce((sum, item) => {
      return sum + Number(item.quantity || 0);
    }, 0) || 0;
  }

  get totalQuantityReceived(): number {
    return this.items?.reduce((sum, item) => {
      return sum + Number(item.receivedQuantity || 0);
    }, 0) || 0;
  }

  get totalQuantityProcessed(): number {
    return this.items?.reduce((sum, item) => {
      const quantityNum = Number(item.quantity || 0);
      const pendingNum = Number(item.pendingQuantity || 0);
      return sum + (quantityNum - pendingNum);
    }, 0) || 0;
  }

  get isFullyReceived(): boolean {
    const ordered = this.totalQuantityOrdered;
    const processed = this.totalQuantityProcessed;
    // Completamente recibido: todo fue procesado
    return ordered > 0 && processed >= ordered;
  }

  get isPartiallyReceived(): boolean {
    const ordered = this.totalQuantityOrdered;
    const processed = this.totalQuantityProcessed;
    // Parcialmente recibido: algo fue procesado pero no todo
    return processed > 0 && processed < ordered;
  }

  get receiptPercentage(): number {
    if (this.totalQuantityOrdered === 0) return 0;
    return (this.totalQuantityReceived / this.totalQuantityOrdered) * 100;
  }

  get daysOverdue(): number {
    if (
      !this.expectedDeliveryDate ||
      this.status === PurchaseOrderStatus.RECEIVED
    ) {
      return 0;
    }
    const diffTime = new Date().getTime() - this.expectedDeliveryDate.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Calcular totales
  calculateTotals(): void {
    if (!this.items || this.items.length === 0) {
      this.subtotal = 0;
      this.taxAmount = 0;
      this.total = 0;
      return;
    }

    // Calcular subtotal
    this.subtotal = this.items.reduce((sum, item) => {
      return sum + item.quantity * item.unitCost;
    }, 0);

    // Calcular impuestos
    this.taxAmount = (this.subtotal * (this.taxPercentage || 0)) / 100;

    // Calcular total
    this.total = this.subtotal + this.taxAmount + (this.shippingCost || 0);

    // Redondear valores
    this.subtotal = Math.round(this.subtotal * 100) / 100;
    this.taxAmount = Math.round(this.taxAmount * 100) / 100;
    this.total = Math.round(this.total * 100) / 100;
  }

  // Actualizar estado basado en recepciones
  updateStatus(): void {
    if (this.isFullyReceived) {
      this.status = PurchaseOrderStatus.RECEIVED;
      this.actualDeliveryDate = new Date();
    } else if (this.isPartiallyReceived) {
      this.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }
  }
}
