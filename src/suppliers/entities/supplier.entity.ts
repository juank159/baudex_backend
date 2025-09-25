import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { PurchaseOrder } from '../../inventory/entities/purchase-order.entity';
import { ProductPurchaseHistory } from '../../inventory/entities/product-purchase-history.entity';

export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
}

export enum SupplierDocumentType {
  NIT = 'nit',
  CC = 'cc',
  CE = 'ce',
  PASSPORT = 'passport',
  RUT = 'rut',
  OTHER = 'other',
}

@Entity('suppliers')
@Unique('UQ_supplier_document_organization', [
  'documentType',
  'documentNumber',
  'organizationId',
])
export class Supplier extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code?: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  documentType: string; // NIT, CC, CE, etc.

  @Column({ type: 'varchar', length: 50, nullable: false })
  documentNumber: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  contactPerson?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  website?: string;

  @Column({
    type: 'enum',
    enum: SupplierStatus,
    default: SupplierStatus.ACTIVE,
  })
  status: SupplierStatus;

  // Información comercial
  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  @Column({ type: 'int', default: 30 })
  paymentTermsDays: number; // Días de plazo de pago

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercentage: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relación con organización (multitenant)
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.suppliers)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Relaciones
  @OneToMany(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.supplier)
  purchaseOrders: PurchaseOrder[];

  @OneToMany(() => ProductPurchaseHistory, (history) => history.supplier)
  purchaseHistory: ProductPurchaseHistory[];

  // Métodos útiles
  get isActive(): boolean {
    return this.status === SupplierStatus.ACTIVE && !this.deletedAt;
  }

  get fullAddress(): string {
    const parts = [this.address, this.city, this.state, this.country].filter(
      Boolean,
    );
    return parts.join(', ');
  }

  get displayName(): string {
    return `${this.name}${this.code ? ` (${this.code})` : ''}`;
  }
}
