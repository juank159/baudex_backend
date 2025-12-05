import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';

/**
 * 🔔 ENUMS DE NOTIFICACIONES
 */

export enum NotificationType {
  // 📦 Inventario FEFO/FIFO
  EXPIRING_PRODUCT = 'expiring_product',
  EXPIRED_PRODUCT = 'expired_product',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',

  // 💳 Cartera y Crédito
  INVOICE_DUE_SOON = 'invoice_due_soon',
  INVOICE_OVERDUE = 'invoice_overdue',
  CUSTOMER_NEAR_CREDIT_LIMIT = 'customer_near_credit_limit',
  CUSTOMER_SUSPENDED = 'customer_suspended',

  // 📝 Aprobaciones (Fase 2)
  APPROVAL_REQUIRED = 'approval_required',
  APPROVAL_APPROVED = 'approval_approved',
  APPROVAL_REJECTED = 'approval_rejected',

  // ℹ️ Sistema
  SYSTEM_INFO = 'system_info',
}

export enum NotificationSeverity {
  INFO = 'info', // 🔵 Informativa
  WARNING = 'warning', // 🟡 Advertencia
  CRITICAL = 'critical', // 🔴 Crítica - Requiere acción inmediata
}

/**
 * 🔔 ENTIDAD NOTIFICATION
 * Sistema profesional de notificaciones con soporte multitenant
 */
@Entity('notifications')
@Index(['organizationId', 'userId']) // Índice compuesto para filtros multitenant
@Index(['userId', 'isRead']) // Índice para notificaciones no leídas
@Index(['type']) // Índice para filtrar por tipo
@Index(['createdAt']) // Índice para orden cronológico
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ========== MULTITENANT ==========
  @Column({ name: 'organization_id' })
  @Index() // Índice individual para seguridad
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // ========== DESTINATARIO ==========
  @Column({ name: 'user_id' })
  @Index() // Índice para buscar notificaciones de un usuario
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ========== TIPO Y SEVERIDAD ==========
  @Column({
    type: 'varchar',
    length: 50,
  })
  type: NotificationType;

  @Column({
    type: 'varchar',
    length: 20,
    default: NotificationSeverity.INFO,
  })
  severity: NotificationSeverity;

  // ========== CONTENIDO ==========
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  // ========== METADATA (Información contextual) ==========
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    // Referencias a entidades
    productId?: string;
    productName?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    customerId?: string;
    customerName?: string;
    batchId?: string;
    batchNumber?: string;

    // Datos numéricos
    quantity?: number;
    amount?: number;
    daysUntilExpiry?: number;
    daysOverdue?: number;
    usagePercent?: number;

    // Acción sugerida
    actionUrl?: string; // URL para redirigir en frontend
    actionLabel?: string; // Texto del botón de acción
  };

  // ========== ESTADO DE LECTURA ==========
  @Column({ name: 'is_read', default: false })
  @Index() // Índice para filtrar no leídas
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date;

  // ========== EMAIL (Opcional) ==========
  @Column({ default: false })
  emailed: boolean;

  @Column({ name: 'emailed_at', type: 'timestamp', nullable: true })
  emailedAt: Date;

  // ========== EXPIRACIÓN (Auto-limpieza) ==========
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  // ========== TIMESTAMPS ==========
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  // ========== MÉTODOS DE UTILIDAD ==========

  /**
   * Obtener el icono según el tipo de notificación
   */
  getIcon(): string {
    const icons = {
      [NotificationType.EXPIRING_PRODUCT]: '🚨',
      [NotificationType.EXPIRED_PRODUCT]: '⚠️',
      [NotificationType.LOW_STOCK]: '📉',
      [NotificationType.OUT_OF_STOCK]: '🚫',
      [NotificationType.INVOICE_DUE_SOON]: '⏰',
      [NotificationType.INVOICE_OVERDUE]: '💳',
      [NotificationType.CUSTOMER_NEAR_CREDIT_LIMIT]: '⚠️',
      [NotificationType.CUSTOMER_SUSPENDED]: '🔴',
      [NotificationType.APPROVAL_REQUIRED]: '📝',
      [NotificationType.APPROVAL_APPROVED]: '✅',
      [NotificationType.APPROVAL_REJECTED]: '❌',
      [NotificationType.SYSTEM_INFO]: 'ℹ️',
    };
    return icons[this.type] || '🔔';
  }

  /**
   * Obtener el color según la severidad
   */
  getSeverityColor(): string {
    const colors = {
      [NotificationSeverity.INFO]: '#3B82F6', // Azul
      [NotificationSeverity.WARNING]: '#F59E0B', // Amarillo
      [NotificationSeverity.CRITICAL]: '#EF4444', // Rojo
    };
    return colors[this.severity] || '#6B7280'; // Gris por defecto
  }

  /**
   * Verificar si la notificación está expirada
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }
}
