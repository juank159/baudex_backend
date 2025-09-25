import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

export enum MovementType {
  PURCHASE = 'purchase', // Compra (entrada)
  SALE = 'sale', // Venta (salida)
  ADJUSTMENT = 'adjustment', // Ajuste de inventario
  INITIAL_STOCK = 'initial_stock', // Stock inicial del producto
  TRANSFER_IN = 'transfer_in', // Transferencia entrada
  TRANSFER_OUT = 'transfer_out', // Transferencia salida
  RETURN_IN = 'return_in', // Devolución entrada
  RETURN_OUT = 'return_out', // Devolución salida
  WASTE = 'waste', // Desperdicio/merma
  PRODUCTION = 'production', // Producción
}

export enum MovementStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

@Entity('inventory_movements')
@Index(['productId', 'movementDate'])
@Index(['organizationId', 'movementDate'])
export class InventoryMovement extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  movementNumber: string;

  @Column({
    type: 'enum',
    enum: MovementType,
  })
  type: MovementType;

  @Column({
    type: 'enum',
    enum: MovementStatus,
    default: MovementStatus.PENDING,
  })
  status: MovementStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  movementDate: Date;

  // Cantidades
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number; // Costo unitario para PEPS

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCost: number; // Costo total del movimiento

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice?: number; // Precio de venta (para salidas)

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalPrice?: number; // Precio total de venta

  // Stock después del movimiento
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  stockAfter: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  stockValueAfter: number; // Valor del stock después del movimiento

  // Referencias
  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceType?: string; // 'invoice', 'purchase_order', 'adjustment', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber?: string;

  @Column({ type: 'uuid', nullable: true })
  referenceId?: string;

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
  @Index()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Usuario que realizó el movimiento
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Relación con almacén
  @Column({ type: 'uuid', nullable: true })
  @Index()
  warehouseId?: string;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.movements)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Warehouse;

  // Generar número de movimiento automáticamente
  @BeforeInsert()
  generateMovementNumber() {
    if (!this.movementNumber) {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-6);
      this.movementNumber = `MOV-${year}${month}-${timestamp}`;
    }
  }

  // Métodos útiles
  get isEntry(): boolean {
    return [
      MovementType.PURCHASE,
      MovementType.TRANSFER_IN,
      MovementType.RETURN_IN,
      MovementType.PRODUCTION,
    ].includes(this.type);
  }

  get isExit(): boolean {
    return [
      MovementType.SALE,
      MovementType.TRANSFER_OUT,
      MovementType.RETURN_OUT,
      MovementType.WASTE,
    ].includes(this.type);
  }

  get isAdjustment(): boolean {
    return this.type === MovementType.ADJUSTMENT;
  }

  get signedQuantity(): number {
    if (this.isEntry) return Math.abs(this.quantity);
    if (this.isExit) return -Math.abs(this.quantity);
    return this.quantity; // Para ajustes, puede ser positivo o negativo
  }
}
