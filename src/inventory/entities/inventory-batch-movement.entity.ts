import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { InventoryBatch } from './inventory-batch.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export enum BatchMovementType {
  CONSUME = 'consume', // Consumo del lote (salida FIFO)
  RESERVE = 'reserve', // Reserva de cantidad
  RELEASE = 'release', // Liberación de reserva
  ADJUST = 'adjust', // Ajuste del lote
  INCOMING = 'incoming', // Entrada al lote (transferencias, compras)
  OUTGOING = 'outgoing', // Salida del lote (transferencias, ventas)
}

/**
 * Movimientos específicos de lotes para trazabilidad FIFO
 * Relaciona cada movimiento de inventario con los lotes específicos afectados
 */
@Entity('inventory_batch_movements')
@Index(['batchId', 'movementDate'])
export class InventoryBatchMovement extends BaseEntity {
  @Column({
    type: 'enum',
    enum: BatchMovementType,
  })
  type: BatchMovementType;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  movementDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalCost: number;

  // Estado del lote después del movimiento
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  batchQuantityAfter: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  batchValueAfter: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relación con lote
  @Column({ type: 'uuid' })
  batchId: string;

  @ManyToOne(() => InventoryBatch, (batch) => batch.movements)
  @JoinColumn({ name: 'batchId' })
  batch: InventoryBatch;

  // Relación con movimiento de inventario
  @Column({ type: 'uuid' })
  movementId: string;

  @ManyToOne(() => InventoryMovement)
  @JoinColumn({ name: 'movementId' })
  inventoryMovement: InventoryMovement;

  // Métodos útiles
  get isConsumption(): boolean {
    return this.type === BatchMovementType.CONSUME;
  }

  get isReservation(): boolean {
    return [BatchMovementType.RESERVE, BatchMovementType.RELEASE].includes(
      this.type,
    );
  }

  get signedQuantity(): number {
    switch (this.type) {
      case BatchMovementType.CONSUME:
        return -Math.abs(this.quantity);
      case BatchMovementType.RESERVE:
        return 0; // No afecta cantidad real, solo reserva
      case BatchMovementType.RELEASE:
        return 0; // No afecta cantidad real, solo libera reserva
      case BatchMovementType.ADJUST:
        return this.quantity; // Puede ser positivo o negativo
      default:
        return this.quantity;
    }
  }
}
