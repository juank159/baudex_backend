// src/products/entities/temporary-product.entity.ts
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity';

@Entity('temporary_products')
export class TemporaryProduct extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'float',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  unitPrice: number;

  @Column({ type: 'varchar', length: 20, default: 'pcs' })
  unit: string;

  @Column({ type: 'varchar', length: 10, default: 'COP' })
  currency: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relación con items de factura
  @OneToMany(() => InvoiceItem, (item) => item.temporaryProduct)
  invoiceItems: InvoiceItem[];

  // Métodos de utilidad
  get isTemporary(): boolean {
    return true;
  }

  get displayName(): string {
    return this.name || 'Producto sin registrar';
  }
}
