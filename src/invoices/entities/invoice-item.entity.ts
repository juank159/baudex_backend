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

  // ✅ RELACIONES MEJORADAS
  @Column({ type: 'uuid', nullable: true })
  invoiceId?: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  // Producto registrado
  @Column({ type: 'uuid', nullable: true })
  productId?: string;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product;

  // ✅ NUEVO: Producto temporal
  @Column({ type: 'uuid', nullable: true })
  temporaryProductId?: string;

  @ManyToOne(() => TemporaryProduct, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'temporaryProductId' })
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

    // Calcular precio base sin IVA (asumiendo 19% IVA incluido)
    const priceWithoutTax = unitPrice / 1.19;
    const baseAmount = quantity * priceWithoutTax;

    // Aplicar descuento
    if (discountPercentage > 0) {
      discountAmount = (baseAmount * discountPercentage) / 100;
      this.discountAmount = Math.round(discountAmount * 100) / 100;
    }

    // Subtotal sin IVA
    this.subtotal = Math.round((baseAmount - discountAmount) * 100) / 100;

    // Asegurar valores numéricos
    this.quantity = Number(this.quantity) || 0;
    this.unitPrice = Number(this.unitPrice) || 0;
    this.discountPercentage = Number(this.discountPercentage) || 0;
    this.discountAmount = Number(this.discountAmount) || 0;
    this.subtotal = Number(this.subtotal) || 0;
  }
}
