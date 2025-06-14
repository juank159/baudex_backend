// src/modules/products/entities/product-price.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

export enum PriceType {
  PRICE1 = 'price1', // Precio al público
  PRICE2 = 'price2', // Precio mayorista
  PRICE3 = 'price3', // Precio distribuidor
  SPECIAL = 'special', // Precio especial
  COST = 'cost', // Precio de costo
}

export enum PriceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('product_prices')
export class ProductPrice extends BaseEntity {
  @Column({
    type: 'enum',
    enum: PriceType,
  })
  type: PriceType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string; // Nombre descriptivo del precio

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PriceStatus,
    default: PriceStatus.ACTIVE,
  })
  status: PriceStatus;

  // Fechas de vigencia
  @Column({ type: 'timestamp', nullable: true })
  validFrom?: Date;

  @Column({ type: 'timestamp', nullable: true })
  validTo?: Date;

  // Descuentos y promociones
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountAmount?: number;

  // Cantidad mínima para aplicar este precio
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  minQuantity: number;

  // Margen de ganancia (calculado automáticamente)
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  profitMargin?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Relación con producto
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.prices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // Métodos útiles
  get isActive(): boolean {
    return this.status === PriceStatus.ACTIVE && !this.deletedAt;
  }

  get isValidNow(): boolean {
    const now = new Date();
    const validFrom = this.validFrom || new Date(0);
    const validTo = this.validTo || new Date('2099-12-31');

    return now >= validFrom && now <= validTo;
  }

  get finalAmount(): number {
    if (this.discountAmount) {
      return Math.max(0, this.amount - this.discountAmount);
    }

    if (this.discountPercentage > 0) {
      return this.amount * (1 - this.discountPercentage / 100);
    }

    return this.amount;
  }

  // Calcular margen de ganancia basado en el precio de costo
  calculateProfitMargin(costPrice: number): number {
    if (costPrice <= 0) return 0;
    return ((this.finalAmount - costPrice) / costPrice) * 100;
  }

  // Formatear precio con moneda
  get formattedAmount(): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: this.currency,
    }).format(this.finalAmount);
  }
}
