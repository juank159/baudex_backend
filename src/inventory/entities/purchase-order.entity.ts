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
  @Column({ type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
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
    precision: 5,
    scale: 2,
    default: 0,
    nullable: true,
  })
  discountPercentage: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    nullable: true,
  })
  discountAmount: number;

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

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierReference?: string; // Referencia del proveedor

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
  @Index()
  warehouseId?: string;

  @ManyToOne('Warehouse')
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: any;

  // Relación con proveedor
  @Column({ type: 'uuid', name: 'supplier_id' })
  @Index()
  supplierId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  // Usuario que creó la orden
  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Usuario que aprobó la orden
  @Column({ type: 'uuid', nullable: true, name: 'approved_by_id' })
  approvedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

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
    const total =
      this.items?.reduce((sum, item) => {
        const orderedQty = Number(item.quantity || 0);
        console.log(
          `   - Item ${item.id}: quantity = ${item.quantity} (type: ${typeof item.quantity}) -> converted: ${orderedQty}`,
        );
        return sum + orderedQty;
      }, 0) || 0;
    console.log(`📊 totalQuantityOrdered calculation: ${total}`);
    return total;
  }

  get totalQuantityReceived(): number {
    const total =
      this.items?.reduce((sum, item) => {
        const receivedQty = Number(item.receivedQuantity || 0);
        console.log(
          `   - Item ${item.id}: receivedQuantity = ${item.receivedQuantity} (type: ${typeof item.receivedQuantity}) -> converted: ${receivedQty}`,
        );
        return sum + receivedQty;
      }, 0) || 0;
    console.log(`📊 totalQuantityReceived calculation: ${total}`);
    return total;
  }

  get totalQuantityProcessed(): number {
    const total =
      this.items?.reduce((sum, item) => {
        const quantityNum = Number(item.quantity || 0);
        const pendingNum = Number(item.pendingQuantity || 0);
        const processedQty = quantityNum - pendingNum;
        console.log(
          `   - Item ${item.id}: processed = ${processedQty} (quantity: ${item.quantity} -> ${quantityNum}, pending: ${item.pendingQuantity} -> ${pendingNum})`,
        );
        return sum + processedQty;
      }, 0) || 0;
    console.log(`📊 totalQuantityProcessed calculation: ${total}`);
    return total;
  }

  get isFullyReceived(): boolean {
    const ordered = this.totalQuantityOrdered;
    const processed = this.totalQuantityProcessed;
    const received = this.totalQuantityReceived;

    // Completamente recibido: todo fue procesado (recibido + dañado + faltante = cantidad ordenada)
    const result = ordered > 0 && processed >= ordered;
    console.log(
      `🎯 isFullyReceived check: processed=${processed} >= ${ordered} = ${result}`,
    );
    console.log(
      `   (Note: received=${received} is for tracking only, not for completion status)`,
    );
    return result;
  }

  get isPartiallyReceived(): boolean {
    const ordered = this.totalQuantityOrdered;
    const processed = this.totalQuantityProcessed;

    // Parcialmente recibido: algo fue procesado pero no todo está completo
    const result = processed > 0 && processed < ordered;
    console.log(
      `🎯 isPartiallyReceived check: processed=${processed} > 0 AND processed < ${ordered} = ${result}`,
    );
    return result;
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

    // Redondear valores
    this.subtotal = Math.round(this.subtotal * 100) / 100;
    this.taxAmount = Math.round(this.taxAmount * 100) / 100;
    this.total = Math.round(this.total * 100) / 100;
    this.discountAmount = Math.round(this.discountAmount * 100) / 100;
  }

  // Actualizar estado basado en recepciones
  updateStatus(): void {
    console.log(`🚀 DEBUG updateStatus() - Order ${this.id}:`);
    console.log(`   - Total Ordered: ${this.totalQuantityOrdered}`);
    console.log(`   - Total Received: ${this.totalQuantityReceived}`);
    console.log(`   - Is Fully Received: ${this.isFullyReceived}`);
    console.log(`   - Is Partially Received: ${this.isPartiallyReceived}`);
    console.log(`   - Current Status: ${this.status}`);

    if (this.isFullyReceived) {
      this.status = PurchaseOrderStatus.RECEIVED;
      this.actualDeliveryDate = new Date();
      console.log(`   ✅ Status updated to: ${this.status}`);
    } else if (this.isPartiallyReceived) {
      this.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
      console.log(`   ⏳ Status updated to: ${this.status}`);
    } else {
      console.log(`   ❌ No status change - keeping: ${this.status}`);
    }
  }
}
