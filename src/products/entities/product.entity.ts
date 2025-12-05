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
import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Category } from '../../categories/entities/category.entity';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { ProductPrice } from './product-price.entity';
import { TaxCategory, RetentionCategory } from '../enums/tax.enums';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
}

export enum ProductType {
  PRODUCT = 'product',
  SERVICE = 'service',
}

/**
 * Métodos de valoración de inventario profesionales
 * Compatible con estándares IFRS (no incluye LIFO prohibido)
 */
export enum InventoryMethod {
  FIFO = 'FIFO',       // First-In, First-Out (estándar)
  FEFO = 'FEFO',       // First-Expired, First-Out (perecederos)
  AVERAGE = 'AVERAGE', // Promedio ponderado
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

  // FIFO Cost for profitability calculations
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  cost: number;

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

  // ========== CAMPOS PARA GESTIÓN AVANZADA DE INVENTARIO (FIFO/FEFO) ==========

  /**
   * Método de valoración de inventario
   * - FIFO: First-In, First-Out (por defecto)
   * - FEFO: First-Expired, First-Out (para perecederos)
   * - AVERAGE: Promedio ponderado
   */
  @Column({
    type: 'enum',
    enum: InventoryMethod,
    default: InventoryMethod.FIFO,
    comment: 'Método de valoración de inventario',
  })
  inventoryMethod: InventoryMethod;

  /**
   * Indica si el producto es perecedero
   * Los productos perecederos requieren control estricto de vencimiento
   */
  @Column({
    type: 'boolean',
    default: false,
    comment: 'Indica si el producto es perecedero',
  })
  isPerishable: boolean;

  /**
   * Indica si se debe rastrear fecha de vencimiento en lotes
   * Si es true, se generan alertas de próximos a vencer
   */
  @Column({
    type: 'boolean',
    default: false,
    comment: 'Habilita tracking de fechas de vencimiento',
  })
  hasExpirationTracking: boolean;

  /**
   * Vida útil del producto en días
   * Se usa para calcular fecha de vencimiento automáticamente
   */
  @Column({
    type: 'int',
    nullable: true,
    comment: 'Vida útil en días desde producción/compra',
  })
  shelfLifeDays?: number;

  /**
   * Días antes del vencimiento para generar alerta
   * Por defecto 7 días
   */
  @Column({
    type: 'int',
    default: 7,
    comment: 'Días antes de vencimiento para alertar',
  })
  alertDaysBeforeExpiry: number;

  // ========== FIN CAMPOS GESTIÓN AVANZADA DE INVENTARIO ==========

  // ========== CAMPOS PARA FACTURACIÓN ELECTRÓNICA ==========

  /**
   * Categoría de impuesto según la DIAN
   * Por defecto IVA para productos físicos
   */
  @Column({
    type: 'enum',
    enum: TaxCategory,
    default: TaxCategory.IVA,
    name: 'tax_category',
    comment: 'Categoría de impuesto para facturación electrónica',
  })
  taxCategory: TaxCategory;

  /**
   * Tasa de impuesto (porcentaje)
   * Ejemplos: 0, 5, 19 para IVA; 4, 8, 16 para INC
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 19,
    name: 'tax_rate',
    comment: 'Tasa de impuesto en porcentaje',
  })
  taxRate: number;

  /**
   * Indica si el producto está sujeto a impuestos
   * Si es false, se ignoran taxCategory y taxRate
   */
  @Column({
    type: 'boolean',
    default: true,
    name: 'is_taxable',
    comment: 'Indica si el producto está gravado con impuestos',
  })
  isTaxable: boolean;

  /**
   * Descripción adicional del impuesto
   * Ejemplo: "IVA 19% - Productos generales"
   */
  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'tax_description',
    comment: 'Descripción del impuesto para la factura',
  })
  taxDescription?: string;

  /**
   * Categoría de retención (opcional)
   * Solo aplica para ciertos productos/clientes
   */
  @Column({
    type: 'enum',
    enum: RetentionCategory,
    nullable: true,
    name: 'retention_category',
    comment: 'Categoría de retención en la fuente',
  })
  retentionCategory?: RetentionCategory;

  /**
   * Tasa de retención (porcentaje)
   * Ejemplo: 15 para RET_IVA, 2.5 para RET_RENTA
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    name: 'retention_rate',
    comment: 'Tasa de retención en porcentaje',
  })
  retentionRate?: number;

  /**
   * Indica si el producto aplica retención
   */
  @Column({
    type: 'boolean',
    default: false,
    name: 'has_retention',
    comment: 'Indica si el producto aplica retención en la fuente',
  })
  hasRetention: boolean;

  // ========== FIN CAMPOS FACTURACIÓN ELECTRÓNICA ==========

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.products)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

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
  // ⚡ OPTIMIZACIÓN: Cambiado de eager a lazy loading para evitar N+1 queries
  // Los precios se cargan explícitamente con leftJoinAndSelect cuando se necesitan
  @OneToMany(() => ProductPrice, (price) => price.product, {
    cascade: true,
    eager: false,  // Cambiado de true a false para optimización
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

  // ========== MÉTODOS PARA FACTURACIÓN ELECTRÓNICA ==========

  /**
   * Calcula el monto del impuesto para un precio dado
   * @param baseAmount Monto base sobre el cual calcular el impuesto
   * @returns Monto del impuesto
   */
  calculateTaxAmount(baseAmount: number): number {
    if (!this.isTaxable) return 0;
    return (baseAmount * this.taxRate) / 100;
  }

  /**
   * Calcula el monto de la retención para un precio dado
   * @param baseAmount Monto base sobre el cual calcular la retención
   * @returns Monto de la retención
   */
  calculateRetentionAmount(baseAmount: number): number {
    if (!this.hasRetention || !this.retentionRate) return 0;
    return (baseAmount * this.retentionRate) / 100;
  }

  /**
   * Obtiene la información de impuestos formateada para Dataico
   * @param quantity Cantidad del producto
   * @param unitPrice Precio unitario
   * @returns Objeto con información de impuestos para API de Dataico
   */
  getTaxInfoForInvoice(quantity: number, unitPrice: number) {
    const baseAmount = quantity * unitPrice;
    const taxAmount = this.calculateTaxAmount(baseAmount);

    return {
      'tax-category': this.taxCategory,
      'tax-rate': this.taxRate,
      'tax-amount': taxAmount,
      'tax-description': this.taxDescription || `${this.taxCategory} ${this.taxRate}%`,
      'tax-base': unitPrice,
      'base-amount': baseAmount,
    };
  }

  /**
   * Obtiene la información de retenciones formateada para Dataico
   * @param quantity Cantidad del producto
   * @param unitPrice Precio unitario
   * @returns Objeto con información de retenciones para API de Dataico o null
   */
  getRetentionInfoForInvoice(quantity: number, unitPrice: number) {
    if (!this.hasRetention || !this.retentionCategory || !this.retentionRate) {
      return null;
    }

    const baseAmount = quantity * unitPrice;
    const retentionAmount = this.calculateRetentionAmount(baseAmount);

    return {
      'tax-category': this.retentionCategory,
      'tax-rate': this.retentionRate,
      'base-amount': baseAmount,
      amount: retentionAmount,
    };
  }

  /**
   * Genera el objeto completo del item para Dataico
   * @param quantity Cantidad
   * @param unitPrice Precio unitario (opcional, usa el precio principal si no se especifica)
   * @param discountRate Tasa de descuento (opcional)
   * @returns Objeto item formateado para API de Dataico
   */
  toDataicoItem(
    quantity: number,
    unitPrice?: number,
    discountRate: number = 0,
  ) {
    // Usar precio principal si no se especifica
    const price = unitPrice || this.prices?.[0]?.amount || 0;
    const originalPrice = price;
    const finalPrice = originalPrice - (originalPrice * discountRate) / 100;

    const taxes = this.isTaxable
      ? [this.getTaxInfoForInvoice(quantity, finalPrice)]
      : [];

    const retentions = this.getRetentionInfoForInvoice(quantity, finalPrice);

    return {
      sku: this.sku,
      'measuring-unit': this.unit || 'UND',
      quantity,
      'original-price': originalPrice,
      'discount-rate': discountRate,
      price: finalPrice,
      description: this.description || this.name,
      taxes,
      ...(retentions && { retentions: [retentions] }),
    };
  }

  // ========== FIN MÉTODOS FACTURACIÓN ELECTRÓNICA ==========
}
