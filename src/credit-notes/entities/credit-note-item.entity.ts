// src/credit-notes/entities/credit-note-item.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CreditNote } from './credit-note.entity';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity';
import { Product } from '../../products/entities/product.entity';

/**
 * Entidad de Item de Nota de Crédito
 *
 * Representa un item individual en una nota de crédito.
 * Puede referenciar un item de factura original y/o un producto.
 */
@Entity('credit_note_items')
@Index('IDX_credit_note_items_credit_note', ['creditNoteId'])
@Index('IDX_credit_note_items_invoice_item', ['invoiceItemId'])
@Index('IDX_credit_note_items_product', ['productId'])
export class CreditNoteItem extends BaseEntity {
  // ==================== REFERENCIAS ====================

  @Column({ type: 'uuid', name: 'credit_note_id' })
  @Index()
  creditNoteId: string;

  @ManyToOne(() => CreditNote, (cn) => cn.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: CreditNote;

  // Referencia al item de factura original (opcional pero recomendado)
  @Column({ type: 'uuid', nullable: true, name: 'invoice_item_id' })
  @Index()
  invoiceItemId: string;

  @ManyToOne(() => InvoiceItem, { nullable: true })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItem: InvoiceItem;

  // Referencia al producto (si aplica)
  @Column({ type: 'uuid', nullable: true, name: 'product_id' })
  @Index()
  productId: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // ==================== DETALLES DEL ITEM ====================

  @Column({ type: 'varchar', length: 500 })
  description: string; // Descripción del item

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  quantity: number; // Cantidad que se está acreditando

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'unit_price' })
  unitPrice: number; // Precio unitario

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number; // Subtotal (cantidad × precio unitario)

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string; // Unidad de medida (unidad, kg, litro, etc.)

  // ==================== COSTOS (para inventario FIFO) ====================

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'unit_cost' })
  unitCost: number; // Costo unitario (para restauración de inventario)

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'total_cost' })
  totalCost: number; // Costo total (cantidad × costo unitario)

  // ==================== DESCUENTOS ====================

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'discount_percentage' })
  discountPercentage: number; // Porcentaje de descuento

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'discount_amount' })
  discountAmount: number; // Monto de descuento

  // ==================== NOTAS ====================

  @Column({ type: 'text', nullable: true })
  notes: string; // Notas adicionales sobre el item

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Metadata adicional

  // ==================== PROPIEDADES COMPUTADAS ====================

  /**
   * Calcular subtotal basado en cantidad y precio unitario
   */
  calculateSubtotal(): number {
    return this.quantity * this.unitPrice;
  }

  /**
   * Calcular costo total basado en cantidad y costo unitario
   */
  calculateTotalCost(): number {
    if (!this.unitCost) return 0;
    return this.quantity * this.unitCost;
  }

  /**
   * Monto final después de descuentos
   */
  get finalAmount(): number {
    return this.subtotal - this.discountAmount;
  }
}
