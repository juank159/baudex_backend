import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export enum PrinterConnectionType {
  NETWORK = 'network',
  USB = 'usb',
}

export enum PrinterPaperSize {
  MM58 = 'mm58',
  MM80 = 'mm80',
}

@Entity('printer_settings')
@Index(['organizationId', 'isActive'])
export class PrinterSettingsEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: PrinterConnectionType,
    default: PrinterConnectionType.NETWORK,
    name: 'connection_type',
  })
  connectionType: PrinterConnectionType;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ type: 'int', nullable: true, default: 9100 })
  port?: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'usb_path' })
  usbPath?: string;

  @Column({
    type: 'enum',
    enum: PrinterPaperSize,
    default: PrinterPaperSize.MM80,
    name: 'paper_size',
  })
  paperSize: PrinterPaperSize;

  @Column({ type: 'boolean', default: true, name: 'auto_cut' })
  autoCut: boolean;

  @Column({ type: 'boolean', default: false, name: 'cash_drawer' })
  cashDrawer: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  // Multitenant
  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
