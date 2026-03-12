import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';

/**
 * 🔔 ENTIDAD DYNAMIC NOTIFICATION STATE
 *
 * Almacena el estado de lectura de notificaciones dinámicas generadas
 * en tiempo real por el dashboard (stock bajo, facturas vencidas, etc.)
 *
 * Las notificaciones dinámicas tienen prefijos como:
 * - stock_xxx (alertas de inventario)
 * - invoice_xxx (alertas de facturas)
 * - payment_xxx (alertas de pagos)
 * - customer_xxx (alertas de clientes)
 * - system_xxx (alertas del sistema)
 * - report_xxx (alertas de reportes)
 * - backup_xxx (alertas de respaldos)
 * - security_xxx (alertas de seguridad)
 */
@Entity('dynamic_notification_states')
@Unique(['dynamicNotificationId', 'userId', 'organizationId'])
@Index(['organizationId', 'userId']) // Índice compuesto para consultas multitenant
@Index(['userId', 'isRead']) // Índice para consultas de no leídas
export class DynamicNotificationState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ========== IDENTIFICADOR DE NOTIFICACIÓN DINÁMICA ==========
  @Column({ name: 'dynamic_notification_id', length: 255 })
  @Index()
  dynamicNotificationId: string;

  // ========== MULTITENANT ==========
  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // ========== USUARIO ==========
  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ========== ESTADO DE LECTURA ==========
  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date;

  // ========== TIMESTAMPS ==========
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
