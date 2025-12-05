import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Organization } from '../../organizations/entities/organization.entity';

/**
 * Historial de precios de compra por producto y proveedor
 * Permite hacer análisis de tendencias de precios y costos
 */
@Entity('product_purchase_history')
@Index(['productId', 'purchaseDate'])
@Index(['supplierId', 'purchaseDate'])
@Index(['organizationId', 'purchaseDate'])
export class ProductPurchaseHistory extends BaseEntity {
  @Column({ type: 'date' })
  @Index()
  purchaseDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalCost: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

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

  // Relación con proveedor
  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseHistory)
  supplier: Supplier;

  // Métodos útiles
  get costPerUnit(): number {
    return this.unitCost;
  }

  // Calcular variación de precio respecto a compra anterior
  calculatePriceVariation(previousCost: number): {
    variation: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const variation = this.unitCost - previousCost;
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
