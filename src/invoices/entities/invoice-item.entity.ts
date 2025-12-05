// import {
//   Entity,
//   Column,
//   ManyToOne,
//   JoinColumn,
//   BeforeInsert,
//   BeforeUpdate,
// } from 'typeorm';
// import { BaseEntity } from '../../common/entities/base.entity';
// import { Invoice } from './invoice.entity';
// import { Product } from '../../products/entities/product.entity';

// @Entity('invoice_items')
// export class InvoiceItem extends BaseEntity {
//   @Column({ type: 'varchar', length: 200 })
//   description: string;

//   // ✅ CAMPOS NUMÉRICOS CORREGIDOS - USAR 'float' CON TRANSFORMERS
//   @Column({
//     type: 'float',
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   quantity: number;

//   @Column({
//     type: 'float',
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   unitPrice: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   discountPercentage: number;

//   @Column({
//     type: 'float',
//     default: 0,
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   discountAmount: number;

//   @Column({
//     type: 'float',
//     transformer: {
//       to: (value: number) => value,
//       from: (value: string | number) =>
//         typeof value === 'string' ? parseFloat(value) : value,
//     },
//   })
//   subtotal: number;

//   @Column({ type: 'varchar', length: 20, nullable: true })
//   unit?: string;

//   @Column({ type: 'text', nullable: true })
//   notes?: string;

//   // Relaciones
//   @Column({ type: 'uuid', nullable: true })
//   invoiceId?: string;

//   @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
//   @JoinColumn({ name: 'invoice_id' })
//   invoice: Invoice;

//   @Column({ type: 'uuid', nullable: true })
//   productId?: string;

//   @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
//   @JoinColumn({ name: 'product_id' })
//   product?: Product;

//   // ✅ CALCULAR SUBTOTAL AUTOMÁTICAMENTE - MÉTODO CORREGIDO
//   // @BeforeInsert()
//   // @BeforeUpdate()
//   // calculateSubtotal(): void {
//   //   // ✅ CONVERSIÓN SEGURA A NÚMEROS
//   //   const quantity = Number(this.quantity) || 0;
//   //   const unitPrice = Number(this.unitPrice) || 0;
//   //   const discountPercentage = Number(this.discountPercentage) || 0;
//   //   let discountAmount = Number(this.discountAmount) || 0;

//   //   let baseAmount = quantity * unitPrice;

//   //   // Aplicar descuento por porcentaje
//   //   if (discountPercentage > 0) {
//   //     discountAmount = (baseAmount * discountPercentage) / 100;
//   //     this.discountAmount = Math.round(discountAmount * 100) / 100;
//   //   }

//   //   // Calcular subtotal final
//   //   this.subtotal = Math.round((baseAmount - discountAmount) * 100) / 100;

//   //   // ✅ ASEGURAR QUE TODOS LOS VALORES SEAN NÚMEROS VÁLIDOS
//   //   this.quantity = Number(this.quantity) || 0;
//   //   this.unitPrice = Number(this.unitPrice) || 0;
//   //   this.discountPercentage = Number(this.discountPercentage) || 0;
//   //   this.discountAmount = Number(this.discountAmount) || 0;
//   //   this.subtotal = Number(this.subtotal) || 0;
//   // }

//   // ✅ MÉTODO CORREGIDO - NO AGREGAR IVA AL SUBTOTAL
//   @BeforeInsert()
//   @BeforeUpdate()
//   calculateSubtotal(): void {
//     const quantity = Number(this.quantity) || 0;
//     const unitPrice = Number(this.unitPrice) || 0; // YA incluye IVA
//     const discountPercentage = Number(this.discountPercentage) || 0;
//     let discountAmount = Number(this.discountAmount) || 0;

//     // ✅ CALCULAR PRECIO BASE SIN IVA (asumiendo 19% IVA incluido)
//     const priceWithoutTax = unitPrice / 1.19; // Remover IVA del precio
//     let baseAmount = quantity * priceWithoutTax; // Base sin IVA

//     // Aplicar descuento al monto base (sin IVA)
//     if (discountPercentage > 0) {
//       discountAmount = (baseAmount * discountPercentage) / 100;
//       this.discountAmount = Math.round(discountAmount * 100) / 100;
//     }

//     // ✅ SUBTOTAL SIN IVA (para que el Invoice calcule IVA después)
//     this.subtotal = Math.round((baseAmount - discountAmount) * 100) / 100;

//     // Asegurar valores numéricos
//     this.quantity = Number(this.quantity) || 0;
//     this.unitPrice = Number(this.unitPrice) || 0;
//     this.discountPercentage = Number(this.discountPercentage) || 0;
//     this.discountAmount = Number(this.discountAmount) || 0;
//     this.subtotal = Number(this.subtotal) || 0;
//   }

//   // ✅ GETTER CORREGIDO PARA PRECIO UNITARIO FINAL
//   get finalUnitPrice(): number {
//     const quantity = Number(this.quantity) || 0;
//     const unitPrice = Number(this.unitPrice) || 0;
//     const discountAmount = Number(this.discountAmount) || 0;

//     if (quantity <= 0) return unitPrice;
//     return unitPrice - discountAmount / quantity;
//   }
// }

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Invoice } from './invoice.entity';
import { Product } from '../../products/entities/product.entity';
import { TemporaryProduct } from '../../products/entities/temporary-product.entity';

@Entity('invoice_items')
export class InvoiceItem extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({
    type: 'float',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  quantity: number;

  @Column({
    type: 'float',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  unitPrice: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  discountPercentage: number;

  @Column({
    type: 'float',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  discountAmount: number;

  @Column({
    type: 'float',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  subtotal: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // ✅ CAMPOS PARA CÁLCULO FIFO
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 4,
    default: 0.0000,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  unitCost?: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.00,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  totalCost?: number;

  // ✅ Porcentaje de IVA del item (para cálculo correcto del subtotal)
  @Column({
    name: 'tax_percentage',
    type: 'float',
    default: 19,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  taxPercentage: number;

  // Relaciones
  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  invoice: Invoice;

  // Producto registrado
  @Column({ type: 'uuid', nullable: true })
  productId?: string;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  product?: Product;

  // Producto temporal
  @Column({ type: 'uuid', nullable: true })
  temporaryProductId?: string;

  @ManyToOne(() => TemporaryProduct, { onDelete: 'SET NULL', nullable: true })
  temporaryProduct?: TemporaryProduct;

  // ✅ GETTER PARA OBTENER EL PRODUCTO (REGISTRADO O TEMPORAL)
  get associatedProduct(): Product | TemporaryProduct | null {
    return this.product || this.temporaryProduct || null;
  }

  get isTemporaryProduct(): boolean {
    return !!this.temporaryProductId;
  }

  @BeforeInsert()
  @BeforeUpdate()
  calculateSubtotal(): void {
    const quantity = Number(this.quantity) || 0;
    const unitPrice = Number(this.unitPrice) || 0;
    const discountPercentage = Number(this.discountPercentage) || 0;
    let discountAmount = Number(this.discountAmount) || 0;

    // ✅ USAR EL IVA DEL ITEM (puede ser 0 para NO_GRAVADO)
    const taxRate = Number(this.taxPercentage) || 0;

    let priceWithoutTax: number;

    if (taxRate > 0) {
      // ✅ SI hay IVA, el precio incluye IVA - extraer base
      const taxDivisor = 1 + (taxRate / 100); // Ej: 5% = 1.05, 19% = 1.19
      priceWithoutTax = unitPrice / taxDivisor;
    } else {
      // ✅ SI NO hay IVA (NO_GRAVADO), el precio ES la base
      priceWithoutTax = unitPrice;
    }

    const baseAmount = quantity * priceWithoutTax;

    // Aplicar descuento
    if (discountPercentage > 0) {
      discountAmount = (baseAmount * discountPercentage) / 100;
      this.discountAmount = Math.round(discountAmount * 100) / 100;
    }

    // Subtotal (base para impuestos)
    this.subtotal = Math.round((baseAmount - discountAmount) * 100) / 100;

    // Asegurar valores numéricos
    this.quantity = Number(this.quantity) || 0;
    this.unitPrice = Number(this.unitPrice) || 0;
    this.discountPercentage = Number(this.discountPercentage) || 0;
    this.discountAmount = Number(this.discountAmount) || 0;
    this.taxPercentage = Number(this.taxPercentage) || 0;
    this.subtotal = Number(this.subtotal) || 0;
  }
}
