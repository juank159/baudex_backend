// // src/modules/products/entities/product.entity.ts - CORREGIDO
// import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
// import { BaseEntity } from '../../common/entities/base.entity';
// import { Category } from '../../categories/entities/category.entity';
// import { User } from '../../users/entities/user.entity';
// import { ProductPrice } from './product-price.entity';

// export enum ProductStatus {
//   ACTIVE = 'active',
//   INACTIVE = 'inactive',
//   OUT_OF_STOCK = 'out_of_stock',
// }

// export enum ProductType {
//   PRODUCT = 'product',
//   SERVICE = 'service',
// }

// @Entity('products')
// export class Product extends BaseEntity {
//   @Column({ type: 'varchar', length: 100 })
//   name: string;

//   @Column({ type: 'text', nullable: true })
//   description?: string;

//   @Column({ type: 'varchar', length: 50, unique: true })
//   sku: string;

//   @Column({ type: 'varchar', length: 20, nullable: true })
//   barcode?: string;

//   @Column({
//     type: 'enum',
//     enum: ProductType,
//     default: ProductType.PRODUCT,
//   })
//   type: ProductType;

//   @Column({
//     type: 'enum',
//     enum: ProductStatus,
//     default: ProductStatus.ACTIVE,
//   })
//   status: ProductStatus;

//   // Stock management
//   @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
//   stock: number;

//   @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
//   minStock: number;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   unit?: string;

//   // Dimensions and weight
//   @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
//   weight?: number;

//   @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
//   length?: number;

//   @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
//   width?: number;

//   @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
//   height?: number;

//   // Media
//   @Column('text', { array: true, nullable: true })
//   images?: string[];

//   // Campos adicionales
//   @Column({ type: 'json', nullable: true })
//   metadata?: Record<string, any>;

//   // ✅ SOLUCIÓN: Cambiar los nombres de las propiedades para que coincidan con el DTO
//   @Column({ type: 'uuid', name: 'category_id' })
//   categoryId: string; // ← Cambio: era category_id, ahora categoryId

//   @ManyToOne(() => Category, (category) => category.products, {
//     onDelete: 'RESTRICT',
//   })
//   @JoinColumn({ name: 'category_id' })
//   category: Category;

//   @Column({ type: 'uuid', name: 'created_by_id' })
//   createdById: string; // ← Cambio: era created_by_id, ahora createdById

//   @ManyToOne(() => User, (user) => user.products, {
//     onDelete: 'RESTRICT',
//   })
//   @JoinColumn({ name: 'created_by_id' })
//   createdBy: User;

//   // Múltiples precios
//   @OneToMany(() => ProductPrice, (price) => price.product, {
//     cascade: true,
//     eager: true,
//   })
//   prices: ProductPrice[];

//   // Métodos útiles
//   get isActive(): boolean {
//     return this.status === ProductStatus.ACTIVE && !this.deletedAt;
//   }

//   get isInStock(): boolean {
//     return this.stock > 0 && this.status !== ProductStatus.OUT_OF_STOCK;
//   }

//   get isLowStock(): boolean {
//     return this.stock <= this.minStock;
//   }

//   get primaryImage(): string | null {
//     return this.images && this.images.length > 0 ? this.images[0] : null;
//   }

//   // Obtener precio por tipo
//   getPriceByType(priceType: string): ProductPrice | undefined {
//     return this.prices?.find(
//       (price) => price.type === priceType && price.isActive && price.isValidNow,
//     );
//   }
// }

// src/modules/products/entities/product.entity.ts - CORRECCIÓN FINAL
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Category } from '../../categories/entities/category.entity';
import { User } from '../../users/entities/user.entity';
import { ProductPrice } from './product-price.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
}

export enum ProductType {
  PRODUCT = 'product',
  SERVICE = 'service',
}

@Entity('products')
export class Product extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  barcode?: string;

  @Column({
    type: 'enum',
    enum: ProductType,
    default: ProductType.PRODUCT,
  })
  type: ProductType;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  // Stock management
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minStock: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  // Dimensions and weight
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  weight?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  height?: number;

  // Media
  @Column('text', { array: true, nullable: true })
  images?: string[];

  // Campos adicionales
  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, (user) => user.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Múltiples precios
  @OneToMany(() => ProductPrice, (price) => price.product, {
    cascade: true,
    eager: true,
  })
  prices: ProductPrice[];

  // ✅ MÉTODOS CORREGIDOS - SOLUCIÓN FINAL
  get isActive(): boolean {
    const result = this.status === ProductStatus.ACTIVE && !this.deletedAt;
    console.log(
      `🔍 Entity isActive para ${this.name}: status=${this.status}, deletedAt=${this.deletedAt}, resultado=${result}`,
    );
    return result;
  }

  get isInStock(): boolean {
    const result = this.stock > 0 && this.status !== ProductStatus.OUT_OF_STOCK;
    console.log(
      `🔍 Entity isInStock para ${this.name}: stock=${this.stock}, status=${this.status}, resultado=${result}`,
    );
    return result;
  }

  // ✅ SOLUCIÓN FINAL: Solo stock <= minStock (usando minStock individual de cada producto)
  get isLowStock(): boolean {
    // ✅ Convertir a números para comparación correcta
    const stock = Number(this.stock) || 0;
    const minStock = Number(this.minStock) || 0;
    const result = stock <= minStock;

    console.log(
      `🔍 Entity isLowStock para ${this.name}: stock=${stock} (num), minStock=${minStock} (num), resultado=${result}`,
    );
    return result;
  }

  get primaryImage(): string | null {
    return this.images && this.images.length > 0 ? this.images[0] : null;
  }

  // Obtener precio por tipo
  getPriceByType(priceType: string): ProductPrice | undefined {
    return this.prices?.find(
      (price) => price.type === priceType && price.isActive && price.isValidNow,
    );
  }

  // ✅ MÉTODO DE DEBUG ACTUALIZADO
  debugStock(): void {
    console.log(`📊 DEBUG Stock para ${this.name}:
      - Stock actual: ${this.stock}
      - Stock mínimo: ${this.minStock}
      - Stock <= MinStock: ${this.stock <= this.minStock}
      - isLowStock: ${this.isLowStock}
      - Status: ${this.status}
      - isActive: ${this.isActive}
      - isInStock: ${this.isInStock}
    `);
  }
}
