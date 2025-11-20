import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from './user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('user_preferences')
export class UserPreferences extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Configuraciones de inventario
  @Column({
    type: 'boolean',
    default: true,
    comment: 'Descontar inventario automáticamente al crear facturas',
  })
  autoDeductInventory: boolean;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Usar FIFO para cálculo de costos',
  })
  useFifoCosting: boolean;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Validar stock antes de crear factura',
  })
  validateStockBeforeInvoice: boolean;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Permitir sobreventa (stock negativo)',
  })
  allowOverselling: boolean;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Mostrar alertas de stock bajo',
  })
  showStockWarnings: boolean;

  // Configuraciones de interfaz
  @Column({
    type: 'boolean',
    default: true,
    comment: 'Mostrar confirmaciones de acciones críticas',
  })
  showConfirmationDialogs: boolean;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Modo compacto en listas',
  })
  useCompactMode: boolean;

  // Configuraciones de notificaciones
  @Column({
    type: 'boolean',
    default: true,
    comment: 'Recibir notificaciones de vencimientos',
  })
  enableExpiryNotifications: boolean;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Recibir notificaciones de stock bajo',
  })
  enableLowStockNotifications: boolean;

  // Almacén por defecto (opcional)
  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Almacén por defecto para movimientos',
  })
  defaultWarehouseId?: string;

  // Configuraciones adicionales en JSON para flexibilidad
  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Configuraciones adicionales en formato JSON',
  })
  additionalSettings?: Record<string, any>;
}
