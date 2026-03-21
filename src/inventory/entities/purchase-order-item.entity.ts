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

  // CRITICAL: transformer ensures TypeORM returns numbers, not strings
  @Column({
    type: 'decimal', precision: 10, scale: 2,
    transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 },
  })
  quantity: number;

  @Column({
    type: 'decimal', precision: 12, scale: 4,
    transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 },
  })
  unitCost: number;

  @Column({
    type: 'decimal', precision: 12, scale: 2,
    transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 },
  })
  subtotal: number;

  @Column({
    type: 'decimal', precision: 5, scale: 2, default: 0, nullable: true,
    transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 },
  })
  taxPercentage: number;

  @Column({
    type: 'decimal', precision: 12, scale: 2, default: 0, nullable: true,
    transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 },
  })
  taxAmount: number;

  @Column({
    type: 'decimal', precision: 12, scale: 2,
    transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 },
  })
  total: number;

  // Cantidades recibidas
  @Column({
    type: 'decimal', precision: 10, scale: 2, default: 0,
    transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 },
  })
  receivedQuantity: number;

  // NOTA: pendingQuantity se calcula, no está en DB
  get pendingQuantity(): number {
    return this.remainingQuantity;
  }

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Relación con orden de compra
  @Column({ type: 'uuid' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  purchaseOrder: PurchaseOrder;

  // Relación con producto
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
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
    this.subtotal = this.quantity * this.unitCost;
    this.taxAmount = (this.subtotal * (this.taxPercentage || 0)) / 100;
    this.total = this.subtotal + this.taxAmount;
  }

  // Recibir cantidad
  receive(receivedQty: number): { received: number; remaining: number } {
    const maxReceivable = this.remainingQuantity;
    const actualReceived = Math.min(receivedQty, maxReceivable);

    this.receivedQuantity =
      Number(this.receivedQuantity) + Number(actualReceived);

    return {
      received: actualReceived,
      remaining: this.remainingQuantity,
    };
  }
}
