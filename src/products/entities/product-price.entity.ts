// src/modules/products/entities/product-price.entity.ts
// import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
// import { BaseEntity } from '../../common/entities/base.entity';
// import { Product } from './product.entity';

// export enum PriceType {
//   PRICE1 = 'price1', // Precio al público
//   PRICE2 = 'price2', // Precio mayorista
//   PRICE3 = 'price3', // Precio distribuidor
//   SPECIAL = 'special', // Precio especial
//   COST = 'cost', // Precio de costo
// }

// export enum PriceStatus {
//   ACTIVE = 'active',
//   INACTIVE = 'inactive',
// }

// @Entity('product_prices')
// export class ProductPrice extends BaseEntity {
//   @Column({
//     type: 'enum',
//     enum: PriceType,
//   })
//   type: PriceType;

//   @Column({ type: 'varchar', length: 100, nullable: true })
//   name?: string; // Nombre descriptivo del precio

//   @Column({ type: 'decimal', precision: 12, scale: 2 })
//   amount: number;

//   @Column({ type: 'varchar', length: 3, default: 'COP' })
//   currency: string;

//   @Column({
//     type: 'enum',
//     enum: PriceStatus,
//     default: PriceStatus.ACTIVE,
//   })
//   status: PriceStatus;

//   // Fechas de vigencia
//   @Column({ type: 'timestamp', nullable: true })
//   validFrom?: Date;

//   @Column({ type: 'timestamp', nullable: true })
//   validTo?: Date;

//   // Descuentos y promociones
//   @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
//   discountPercentage: number;

//   @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
//   discountAmount?: number;

//   // Cantidad mínima para aplicar este precio
//   @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
//   minQuantity: number;

//   // Margen de ganancia (calculado automáticamente)
//   @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
//   profitMargin?: number;

//   @Column({ type: 'text', nullable: true })
//   notes?: string;

//   // Relación con producto
//   @Column({ type: 'uuid' })
//   productId: string;

//   @ManyToOne(() => Product, (product) => product.prices, {
//     onDelete: 'CASCADE',
//   })
//   @JoinColumn({ name: 'product_id' })
//   product: Product;

//   // Métodos útiles
//   get isActive(): boolean {
//     return this.status === PriceStatus.ACTIVE && !this.deletedAt;
//   }

//   get isValidNow(): boolean {
//     const now = new Date();
//     const validFrom = this.validFrom || new Date(0);
//     const validTo = this.validTo || new Date('2099-12-31');

//     return now >= validFrom && now <= validTo;
//   }

//   get finalAmount(): number {
//     if (this.discountAmount) {
//       return Math.max(0, this.amount - this.discountAmount);
//     }

//     if (this.discountPercentage > 0) {
//       return this.amount * (1 - this.discountPercentage / 100);
//     }

//     return this.amount;
//   }

//   // Calcular margen de ganancia basado en el precio de costo
//   calculateProfitMargin(costPrice: number): number {
//     if (costPrice <= 0) return 0;
//     return ((this.finalAmount - costPrice) / costPrice) * 100;
//   }

//   // Formatear precio con moneda
//   get formattedAmount(): string {
//     return new Intl.NumberFormat('es-CO', {
//       style: 'currency',
//       currency: this.currency,
//     }).format(this.finalAmount);
//   }
// }

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

  @Column({ type: 'int', default: 1 })
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
    const validTo = this.validTo || new Date('2099-12-31T23:59:59Z');

    return now >= validFrom && now <= validTo;
  }

  // ✅ CORREGIDO: finalAmount con validación de tipos
  get finalAmount(): number {
    // Convertir amount a número si viene como string de la DB
    const baseAmount = Number(this.amount) || 0;
    const discountAmt = Number(this.discountAmount) || 0;
    const discountPct = Number(this.discountPercentage) || 0;

    if (discountAmt > 0) {
      return Math.max(0, baseAmount - discountAmt);
    }

    if (discountPct > 0) {
      return baseAmount * (1 - discountPct / 100);
    }

    return baseAmount;
  }

  // ✅ CORREGIDO: formattedAmount con validación de tipos y manejo de errores
  get formattedAmount(): string {
    try {
      const amount = this.finalAmount;

      // Validar que es un número válido
      if (typeof amount !== 'number' || isNaN(amount)) {
        return `${this.currency || 'COP'} 0.00`;
      }

      // Formatear el número
      const formattedNumber = amount.toFixed(2);

      // Usar Intl.NumberFormat si está disponible, sino formato manual
      if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: this.currency || 'COP',
        }).format(amount);
      }

      // Fallback manual
      return `${this.currency || 'COP'} ${formattedNumber}`;
    } catch (error) {
      console.error('Error formatting amount:', error);
      return `${this.currency || 'COP'} 0.00`;
    }
  }

  // ✅ CORREGIDO: Calcular margen de ganancia con validación
  calculateProfitMargin(costPrice: number): number {
    const cost = Number(costPrice) || 0;
    const final = this.finalAmount;

    if (cost <= 0 || final <= 0) return 0;

    return ((final - cost) / cost) * 100;
  }
}
