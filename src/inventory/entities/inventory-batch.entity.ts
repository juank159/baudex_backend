import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { InventoryBatchMovement } from './inventory-batch-movement.entity';

export enum BatchStatus {
  ACTIVE = 'active',
  DEPLETED = 'depleted',
  EXPIRED = 'expired',
  BLOCKED = 'blocked',
}

/**
 * Entidad para manejar lotes de inventario (PEPS/FIFO)
 * Cada vez que se recibe mercancía, se crea un nuevo lote
 * Las salidas se toman del lote más antiguo primero (FIFO)
 */
@Entity('inventory_batches')
@Index(['productId', 'purchaseDate'])
@Index(['organizationId', 'status'])
export class InventoryBatch extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  batchNumber: string;

  @Column({ type: 'timestamp', name: 'purchase_date' })
  @Index()
  purchaseDate: Date;

  @Column({ type: 'date', nullable: true })
  expirationDate?: Date;

  // Cantidades PEPS
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number; // Cantidad total del lote (legacy, mantener sincronizado con originalQuantity)

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  remainingQuantity: number; // Cantidad restante (legacy, mantener sincronizado con currentQuantity)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  originalQuantity: number; // Cantidad inicial del lote

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentQuantity: number; // Cantidad actual disponible

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reservedQuantity: number; // Cantidad reservada

  // Costos PEPS
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  unitCost: number; // Costo unitario de este lote

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalCost: number; // Costo total del lote

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  remainingValue: number; // Valor restante del lote

  @Column({
    type: 'enum',
    enum: BatchStatus,
    default: BatchStatus.ACTIVE,
  })
  status: BatchStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierLotNumber?: string; // Número de lote del proveedor

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

  // Relación con producto
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
  product: Product;

  // Relación con orden de compra (opcional)
  @Column({ type: 'uuid', nullable: true })
  purchaseOrderId?: string;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  purchaseOrder?: PurchaseOrder;

  // Relación con almacén
  @Column({ type: 'uuid', nullable: true })
  @Index()
  warehouseId?: string;

  // Movimientos de este lote
  @OneToMany(() => InventoryBatchMovement, (movement) => movement.batch)
  movements: InventoryBatchMovement[];

  // Métodos útiles
  get availableQuantity(): number {
    return this.currentQuantity - this.reservedQuantity;
  }

  get isActive(): boolean {
    return (
      this.status === BatchStatus.ACTIVE &&
      this.availableQuantity > 0 &&
      !this.deletedAt
    );
  }

  get isDepleted(): boolean {
    return this.currentQuantity <= 0;
  }

  get isExpired(): boolean {
    if (!this.expirationDate) return false;
    return new Date() > this.expirationDate;
  }

  get daysUntilExpiration(): number | null {
    if (!this.expirationDate) return null;
    const diffTime = this.expirationDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get utilizationPercentage(): number {
    if (this.originalQuantity === 0) return 0;
    return (
      ((this.originalQuantity - this.currentQuantity) / this.originalQuantity) *
      100
    );
  }

  // Calcular el costo promedio ponderado actual
  get averageCostPerUnit(): number {
    if (this.currentQuantity === 0) return 0;
    return this.remainingValue / this.currentQuantity;
  }

  // Actualizar estado basado en cantidad
  updateStatus(): void {
    if (this.currentQuantity <= 0) {
      this.status = BatchStatus.DEPLETED;
    } else if (this.isExpired) {
      this.status = BatchStatus.EXPIRED;
    } else {
      this.status = BatchStatus.ACTIVE;
    }
  }

  // Consumir cantidad del lote (FIFO)
  consume(quantity: number): { consumed: number; cost: number } {
    const consumedQty = Math.min(quantity, this.availableQuantity);
    const consumedCost = consumedQty * this.unitCost;

    this.currentQuantity -= consumedQty;
    this.remainingValue -= consumedCost;

    this.updateStatus();

    return {
      consumed: consumedQty,
      cost: consumedCost,
    };
  }

  // Reservar cantidad
  reserve(quantity: number): number {
    const reservableQty = Math.min(quantity, this.availableQuantity);
    this.reservedQuantity += reservableQty;
    return reservableQty;
  }

  // Liberar reserva
  releaseReservation(quantity: number): number {
    const releasedQty = Math.min(quantity, this.reservedQuantity);
    this.reservedQuantity -= releasedQty;
    return releasedQty;
  }
}
