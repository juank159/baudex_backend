import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Sale } from './sale.entity';
import { Product } from '../../products/entities/product.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('sale_items')
@Index(['saleId', 'productId'])
export class SaleItem extends BaseEntity {
  @Column({ type: 'int' })
  lineNumber: number; // Número de línea en la venta

  // CRITICAL: transformer ensures TypeORM returns numbers, not strings (decimal columns)
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  totalPrice: number;

  // Costo para análisis de rentabilidad (PEPS)
  @Column({ type: 'decimal', precision: 12, scale: 4, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  totalCost: number;

  // Descuentos específicos del item
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  discountPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  finalPrice: number; // Precio final después de descuentos

  // Rentabilidad del item
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  itemProfit: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: { to: (v: number) => v, from: (v: string | number) => typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0 } })
  profitMargin: number;

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

  // Relación con venta
  @Column({ type: 'uuid' })
  saleId: string;

  @ManyToOne(() => Sale, (sale) => sale.items, {
    onDelete: 'CASCADE',
  })
  sale: Sale;

  // Relación con producto
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
  product: Product;

  // Métodos útiles
  get netPrice(): number {
    return this.finalPrice;
  }

  get profitPerUnit(): number {
    return this.unitPrice - this.unitCost;
  }

  get profitMarginPercentage(): number {
    if (this.unitPrice === 0) return 0;
    return ((this.unitPrice - this.unitCost) / this.unitPrice) * 100;
  }

  get hasDiscount(): boolean {
    return this.discountPercentage > 0 || this.discountAmount > 0;
  }

  // Calcular precios y rentabilidad
  calculatePrices(): void {
    // Calcular precio total
    this.totalPrice = this.quantity * this.unitPrice;

    // Aplicar descuentos
    let discountAmount = this.discountAmount || 0;
    if (this.discountPercentage > 0) {
      discountAmount = (this.totalPrice * this.discountPercentage) / 100;
      this.discountAmount = discountAmount;
    }

    // Precio final después de descuentos
    this.finalPrice = this.totalPrice - discountAmount;

    // Calcular costo total
    this.totalCost = this.quantity * this.unitCost;

    // Calcular rentabilidad
    this.itemProfit = this.finalPrice - this.totalCost;
    this.profitMargin =
      this.finalPrice > 0 ? (this.itemProfit / this.finalPrice) * 100 : 0;

    // Redondear valores
    this.totalPrice = Math.round(this.totalPrice * 100) / 100;
    this.finalPrice = Math.round(this.finalPrice * 100) / 100;
    this.totalCost = Math.round(this.totalCost * 100) / 100;
    this.itemProfit = Math.round(this.itemProfit * 100) / 100;
    this.profitMargin = Math.round(this.profitMargin * 100) / 100;
    this.discountAmount = Math.round(this.discountAmount * 100) / 100;
  }

  // Aplicar descuento
  applyDiscount(percentage?: number, amount?: number): void {
    if (percentage !== undefined) {
      this.discountPercentage = percentage;
      this.discountAmount = 0;
    } else if (amount !== undefined) {
      this.discountAmount = amount;
      this.discountPercentage = 0;
    }
    this.calculatePrices();
  }

  // Actualizar costo unitario (para análisis PEPS)
  updateUnitCost(newUnitCost: number): void {
    this.unitCost = newUnitCost;
    this.calculatePrices();
  }
}
