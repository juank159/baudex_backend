import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from '../../products/entities/product.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('purchase_order_items')
@Index(['purchaseOrderId', 'productId'])
export class PurchaseOrderItem extends BaseEntity {
  @Column({ type: 'int' })
  lineNumber: number; // Número de línea en la orden

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalCost: number;

  // Cantidades recibidas
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  receivedQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingQuantity: number;

  // Fechas
  @Column({ type: 'date', nullable: true })
  expectedDate?: Date;

  @Column({ type: 'date', nullable: true })
  lastReceivedDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id', nullable: true })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relación con orden de compra
  @Column({ type: 'uuid', name: 'purchase_order_id' })
  @Index()
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  // Relación con producto
  @Column({ type: 'uuid', name: 'product_id' })
  @Index()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // Métodos útiles
  get isFullyReceived(): boolean {
    return this.receivedQuantity >= this.quantity;
  }

  get isPartiallyReceived(): boolean {
    return this.receivedQuantity > 0 && this.receivedQuantity < this.quantity;
  }

  get receiptPercentage(): number {
    if (this.quantity === 0) return 0;
    return (this.receivedQuantity / this.quantity) * 100;
  }

  get remainingQuantity(): number {
    return Math.max(0, this.quantity - this.receivedQuantity);
  }

  // Calcular costo total
  calculateTotalCost(): void {
    this.totalCost = this.quantity * this.unitCost;
  }

  // Actualizar cantidades pendientes
  updatePendingQuantity(): void {
    this.pendingQuantity = this.remainingQuantity;
  }

  // Recibir cantidad
  receive(receivedQty: number): { received: number; remaining: number } {
    console.log(
      `🔢 DEBUG - receive() called with: ${receivedQty} (type: ${typeof receivedQty})`,
    );
    console.log(
      `🔢 DEBUG - Current receivedQuantity: ${this.receivedQuantity} (type: ${typeof this.receivedQuantity})`,
    );
    console.log(
      `🔢 DEBUG - Current quantity: ${this.quantity} (type: ${typeof this.quantity})`,
    );

    const maxReceivable = this.remainingQuantity;
    const actualReceived = Math.min(receivedQty, maxReceivable);

    console.log(`🔢 DEBUG - maxReceivable: ${maxReceivable}`);
    console.log(`🔢 DEBUG - actualReceived: ${actualReceived}`);
    console.log(
      `🔢 DEBUG - Before update - receivedQuantity: ${this.receivedQuantity}`,
    );

    this.receivedQuantity =
      Number(this.receivedQuantity) + Number(actualReceived);

    console.log(
      `🔢 DEBUG - After update - receivedQuantity: ${this.receivedQuantity} (type: ${typeof this.receivedQuantity})`,
    );

    this.lastReceivedDate = new Date();
    this.updatePendingQuantity();

    return {
      received: actualReceived,
      remaining: this.remainingQuantity,
    };
  }
}
