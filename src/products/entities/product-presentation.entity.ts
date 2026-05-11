import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string | number) =>
    typeof v === 'string' ? parseFloat(v) || 0 : v ?? 0,
};

/**
 * Presentación de venta de un producto.
 *
 * Permite vender un mismo producto en múltiples formatos (cartón, cajetilla,
 * media docena, kilo, gramo, paquete, unidad, etc.) con su propio precio y
 * código de barras. El stock siempre vive en la `baseUnit` del producto, y al
 * vender una presentación se descuenta `quantity * factor` del stock base.
 *
 * Ejemplos:
 *   - Huevos: baseUnit="und". Presentaciones: "Cartón" (factor=30), "Media
 *     docena" (factor=6), "Unidad" (factor=1).
 *   - Queso a granel: baseUnit="g". Presentaciones: "Gramo" (factor=1),
 *     "Kilo" (factor=1000) con precio mayorista distinto al proporcional.
 */
@Entity('product_presentations')
@Index(['productId'])
@Index(['barcode'])
export class ProductPresentation extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  name: string;

  /**
   * Factor de conversión a la unidad base del producto.
   * Ej: si baseUnit="und" y la presentación es "Cartón" de huevos → factor=30.
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 1,
    transformer: decimalTransformer,
  })
  factor: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  barcode?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sku?: string;

  /**
   * Presentación que el POS muestra primero al seleccionar el producto.
   * Solo una presentación por producto debería marcarse como default
   * (validación a nivel servicio).
   */
  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.presentations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
