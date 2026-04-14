import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('warehouses')
export class Warehouse extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isMainWarehouse: boolean;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => InventoryMovement, (movement) => movement.warehouse)
  movements: InventoryMovement[];

  get displayName(): string {
    return `${this.name} (${this.code})`;
  }
}
