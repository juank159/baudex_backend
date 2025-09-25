import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { PurchaseOrder } from './purchase-order.entity';

/**
 * Historial de precios de compra por producto y proveedor
 * Permite hacer análisis de tendencias de precios y costos
 */
@Entity('product_purchase_history')
@Index(['productId', 'purchaseDate'])
@Index(['supplierId', 'purchaseDate'])
@Index(['organizationId', 'purchaseDate'])
export class ProductPurchaseHistory extends BaseEntity {
  @Column({ type: 'timestamp' })
  @Index()
  purchaseDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalCost: number;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  // Costos adicionales
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  // Costo final unitario (incluyendo todos los costos)
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  finalUnitCost: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierLotNumber?: string;

  @Column({ type: 'date', nullable: true })
  expirationDate?: Date;

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
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // Relación con proveedor
  @Column({ type: 'uuid' })
  @Index()
  supplierId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseHistory)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  // Relación con orden de compra (opcional)
  @Column({ type: 'uuid', nullable: true })
  purchaseOrderId?: string;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: PurchaseOrder;

  // Métodos útiles
  get costPerUnit(): number {
    return this.finalUnitCost;
  }

  get totalCostWithExtras(): number {
    return (
      this.totalCost + this.shippingCost + this.taxAmount - this.discountAmount
    );
  }

  get hasExpiration(): boolean {
    return !!this.expirationDate;
  }

  get daysUntilExpiration(): number | null {
    if (!this.expirationDate) return null;
    const diffTime = this.expirationDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get isExpired(): boolean {
    if (!this.expirationDate) return false;
    return new Date() > this.expirationDate;
  }

  // Calcular variación de precio respecto a compra anterior
  calculatePriceVariation(previousCost: number): {
    variation: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const variation = this.finalUnitCost - previousCost;
    const percentage = previousCost > 0 ? (variation / previousCost) * 100 : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(percentage) > 0.01) {
      // Considerar cambios mayores a 0.01%
      trend = variation > 0 ? 'up' : 'down';
    }

    return {
      variation: Math.round(variation * 10000) / 10000,
      percentage: Math.round(percentage * 100) / 100,
      trend,
    };
  }
}
