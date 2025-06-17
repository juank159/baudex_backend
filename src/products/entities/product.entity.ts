// src/modules/products/entities/product.entity.ts
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

//   @Column({ type: 'varchar', length: 20, nullable: true })
//   unit?: string; // kg, pcs, m², etc.

//   // Dimensiones y peso
//   @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
//   weight?: number;

//   @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
//   length?: number;

//   @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
//   width?: number;

//   @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
//   height?: number;

//   // Imágenes (JSON array)
//   @Column({ type: 'json', nullable: true })
//   images?: string[];

//   // Metadatos adicionales
//   @Column({ type: 'json', nullable: true })
//   metadata?: Record<string, any>;

//   // Relaciones
//   @Column({ type: 'uuid' })
//   categoryId: string;

//   @ManyToOne(() => Category, (category) => category.products, {
//     onDelete: 'RESTRICT',
//   })
//   @JoinColumn({ name: 'category_id' })
//   category: Category;

//   @Column({ type: 'uuid' })
//   createdById: string;

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
//       (price) => price.type === priceType && price.isActive,
//     );
//   }

//   // Obtener precio por defecto (precio1 o el primero activo)
//   get defaultPrice(): ProductPrice | undefined {
//     return (
//       this.getPriceByType('price1') ||
//       this.prices?.find((price) => price.isActive)
//     );
//   }
// }

// src/modules/products/entities/product.entity.ts - CORREGIDO
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

  // ✅ SOLUCIÓN: Cambiar los nombres de las propiedades para que coincidan con el DTO
  @Column({ type: 'uuid', name: 'category_id' })
  categoryId: string; // ← Cambio: era category_id, ahora categoryId

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string; // ← Cambio: era created_by_id, ahora createdById

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

  // Métodos útiles
  get isActive(): boolean {
    return this.status === ProductStatus.ACTIVE && !this.deletedAt;
  }

  get isInStock(): boolean {
    return this.stock > 0 && this.status !== ProductStatus.OUT_OF_STOCK;
  }

  get isLowStock(): boolean {
    return this.stock <= this.minStock;
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
}
