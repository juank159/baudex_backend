// src/credit-notes/entities/credit-note.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { CreditNoteItem } from './credit-note-item.entity';

/**
 * Tipos de nota de crédito
 */
export enum CreditNoteType {
  FULL = 'full', // Reversión completa de la factura
  PARTIAL = 'partial', // Reversión parcial
}

/**
 * Razones para emitir nota de crédito
 */
export enum CreditNoteReason {
  RETURNED_GOODS = 'returned_goods', // Devolución de mercancía
  DAMAGED_GOODS = 'damaged_goods', // Mercancía dañada
  BILLING_ERROR = 'billing_error', // Error de facturación
  PRICE_ADJUSTMENT = 'price_adjustment', // Ajuste de precio
  ORDER_CANCELLATION = 'order_cancellation', // Cancelación de pedido
  CUSTOMER_DISSATISFACTION = 'customer_dissatisfaction', // Insatisfacción del cliente
  INVENTORY_ADJUSTMENT = 'inventory_adjustment', // Ajuste de inventario
  DISCOUNT_GRANTED = 'discount_granted', // Descuento otorgado
  OTHER = 'other', // Otro
}

/**
 * Estados de nota de crédito
 */
export enum CreditNoteStatus {
  DRAFT = 'draft', // Borrador (creada pero no confirmada)
  CONFIRMED = 'confirmed', // Confirmada y aplicada al balance del cliente
  CANCELLED = 'cancelled', // Cancelada (raro, pero disponible)
}

/**
 * Entidad de Nota de Crédito
 *
 * Representa un documento que revierte total o parcialmente una factura.
 * Sigue los estándares internacionales de contabilidad y el principio de
 * inmutabilidad de facturas.
 */
@Entity('credit_notes')
@Index('IDX_credit_notes_organization_number_unique', ['organizationId', 'number'], { unique: true })
@Index('IDX_credit_notes_invoice', ['invoiceId'])
@Index('IDX_credit_notes_customer', ['customerId'])
@Index('IDX_credit_notes_date', ['date'])
@Index('IDX_credit_notes_status', ['status'])
@Index('IDX_credit_notes_organization_date', ['organizationId', 'date'])
@Index('IDX_credit_notes_organization_status', ['organizationId', 'status'])
export class CreditNote extends BaseEntity {
  // ==================== IDENTIFICACIÓN ====================

  @Column({ type: 'varchar', length: 50 })
  number: string; // Número de nota de crédito (CN-001, CN-002, etc.)

  @Column({ type: 'timestamptz' })
  date: Date; // Fecha de emisión

  // ==================== REFERENCIAS ====================

  @Column({ type: 'uuid', name: 'invoice_id' })
  @Index()
  invoiceId: string; // Factura original que se está acreditando

  @ManyToOne(() => Invoice, { nullable: false })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'uuid', name: 'customer_id' })
  @Index()
  customerId: string;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // ==================== TIPO Y RAZÓN ====================

  @Column({
    type: 'enum',
    enum: CreditNoteType,
    default: CreditNoteType.PARTIAL,
  })
  type: CreditNoteType; // Tipo de nota de crédito

  @Column({
    type: 'enum',
    enum: CreditNoteReason,
  })
  reason: CreditNoteReason; // Razón de la nota de crédito

  @Column({ type: 'text', nullable: true, name: 'reason_description' })
  reasonDescription: string; // Descripción adicional de la razón

  // ==================== ITEMS ====================

  @OneToMany(() => CreditNoteItem, (item) => item.creditNote, {
    cascade: true,
  })
  items: CreditNoteItem[];

  // ==================== MONTOS ====================

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number; // Subtotal sin impuestos

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 19, name: 'tax_percentage' })
  taxPercentage: number; // Porcentaje de impuesto (IVA)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number; // Monto del impuesto

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number; // Total de la nota de crédito

  // ==================== ESTADO ====================

  @Column({
    type: 'enum',
    enum: CreditNoteStatus,
    default: CreditNoteStatus.DRAFT,
  })
  status: CreditNoteStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'applied_at' })
  appliedAt: Date; // Cuándo se aplicó el crédito al balance del cliente

  @Column({ type: 'uuid', nullable: true, name: 'applied_by_id' })
  appliedById: string; // Quién aplicó la nota de crédito

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'applied_by_id' })
  appliedBy: User;

  // ==================== IMPACTO EN INVENTARIO ====================

  @Column({ type: 'boolean', default: false, name: 'restore_inventory' })
  restoreInventory: boolean; // ¿Deben los items devueltos agregarse de vuelta al inventario?

  @Column({ type: 'boolean', default: false, name: 'inventory_restored' })
  inventoryRestored: boolean; // ¿Se ha restaurado el inventario?

  @Column({ type: 'timestamptz', nullable: true, name: 'inventory_restored_at' })
  inventoryRestoredAt: Date; // Cuándo se restauró el inventario

  // ==================== NOTAS Y METADATA ====================

  @Column({ type: 'text', nullable: true })
  notes: string; // Notas adicionales

  @Column({ type: 'text', nullable: true })
  terms: string; // Términos y condiciones

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Metadata adicional (JSON flexible)

  // ==================== PROPIEDADES COMPUTADAS ====================

  /**
   * ¿Puede ser editada esta nota de crédito?
   */
  get canBeEdited(): boolean {
    return this.status === CreditNoteStatus.DRAFT;
  }

  /**
   * ¿Puede ser confirmada esta nota de crédito?
   */
  get canBeConfirmed(): boolean {
    return this.status === CreditNoteStatus.DRAFT;
  }

  /**
   * ¿Puede ser cancelada esta nota de crédito?
   */
  get canBeCancelled(): boolean {
    return this.status === CreditNoteStatus.DRAFT;
  }

  /**
   * ¿Está confirmada esta nota de crédito?
   */
  get isConfirmed(): boolean {
    return this.status === CreditNoteStatus.CONFIRMED;
  }

  /**
   * ¿Está cancelada esta nota de crédito?
   */
  get isCancelled(): boolean {
    return this.status === CreditNoteStatus.CANCELLED;
  }

  /**
   * Nombre para mostrar del tipo
   */
  get typeDisplayName(): string {
    const names = {
      [CreditNoteType.FULL]: 'Completa',
      [CreditNoteType.PARTIAL]: 'Parcial',
    };
    return names[this.type] || this.type;
  }

  /**
   * Nombre para mostrar de la razón
   */
  get reasonDisplayName(): string {
    const names = {
      [CreditNoteReason.RETURNED_GOODS]: 'Devolución de Mercancía',
      [CreditNoteReason.DAMAGED_GOODS]: 'Mercancía Dañada',
      [CreditNoteReason.BILLING_ERROR]: 'Error de Facturación',
      [CreditNoteReason.PRICE_ADJUSTMENT]: 'Ajuste de Precio',
      [CreditNoteReason.ORDER_CANCELLATION]: 'Cancelación de Pedido',
      [CreditNoteReason.CUSTOMER_DISSATISFACTION]: 'Insatisfacción del Cliente',
      [CreditNoteReason.INVENTORY_ADJUSTMENT]: 'Ajuste de Inventario',
      [CreditNoteReason.DISCOUNT_GRANTED]: 'Descuento Otorgado',
      [CreditNoteReason.OTHER]: 'Otro',
    };
    return names[this.reason] || this.reason;
  }

  /**
   * Nombre para mostrar del estado
   */
  get statusDisplayName(): string {
    const names = {
      [CreditNoteStatus.DRAFT]: 'Borrador',
      [CreditNoteStatus.CONFIRMED]: 'Confirmada',
      [CreditNoteStatus.CANCELLED]: 'Cancelada',
    };
    return names[this.status] || this.status;
  }
}
