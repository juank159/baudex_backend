import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🔔 MIGRACIÓN: Sistema de Notificaciones Profesional
 *
 * CARACTERÍSTICAS:
 * - Soporte multitenant completo
 * - Índices optimizados para consultas rápidas
 * - Campos de metadata JSONB para flexibilidad
 * - Auto-expiración de notificaciones antiguas
 * - Soporte para email opcional
 */
export class CreateNotificationsTable1763940000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla de notificaciones
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        -- ID y timestamps
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,

        -- MULTITENANT (Crítico para seguridad)
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Tipo y severidad
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',

        -- Contenido
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB NULL,

        -- Estado de lectura
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMP NULL,

        -- Email (opcional)
        emailed BOOLEAN NOT NULL DEFAULT FALSE,
        emailed_at TIMESTAMP NULL,

        -- Expiración (auto-limpieza)
        expires_at TIMESTAMP NULL,

        -- Constraint: Verificar que type es válido
        CONSTRAINT chk_notification_type CHECK (
          type IN (
            'expiring_product',
            'expired_product',
            'low_stock',
            'out_of_stock',
            'invoice_due_soon',
            'invoice_overdue',
            'customer_near_credit_limit',
            'customer_suspended',
            'approval_required',
            'approval_approved',
            'approval_rejected',
            'system_info'
          )
        ),

        -- Constraint: Verificar que severity es válida
        CONSTRAINT chk_notification_severity CHECK (
          severity IN ('info', 'warning', 'critical')
        )
      );
    `);

    // ========== ÍNDICES OPTIMIZADOS ==========

    // 1. Índice compuesto MULTITENANT (organization + user)
    // Uso: Obtener todas las notificaciones de un usuario en una organización
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_org_user
      ON notifications(organization_id, user_id);
    `);

    // 2. Índice para notificaciones NO LEÍDAS (más común)
    // Uso: Contador de notificaciones no leídas
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_unread
      ON notifications(user_id, is_read)
      WHERE is_read = FALSE AND deleted_at IS NULL;
    `);

    // 3. Índice por tipo de notificación
    // Uso: Filtrar por tipo específico (ej: solo inventario)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_type
      ON notifications(type);
    `);

    // 4. Índice por fecha de creación (orden cronológico DESC)
    // Uso: Mostrar notificaciones más recientes primero
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created
      ON notifications(created_at DESC);
    `);

    // 5. Índice por severidad
    // Uso: Filtrar notificaciones críticas
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_severity
      ON notifications(severity)
      WHERE deleted_at IS NULL;
    `);

    // 6. Índice para expiración
    // Uso: Limpiar notificaciones expiradas automáticamente
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_expires
      ON notifications(expires_at)
      WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
    `);

    // 7. Índice INDIVIDUAL de organization_id (seguridad multitenant)
    // Uso: Asegurar que todas las queries filtren por organización
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_organization
      ON notifications(organization_id);
    `);

    // ========== COMENTARIOS PARA DOCUMENTACIÓN ==========
    await queryRunner.query(`
      COMMENT ON TABLE notifications IS
      'Sistema profesional de notificaciones con soporte multitenant - Fase 1';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN notifications.metadata IS
      'Información contextual en formato JSONB: productId, invoiceId, cantidad, etc.';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN notifications.expires_at IS
      'Fecha de auto-expiración para limpieza automática de notificaciones antiguas';
    `);

    console.log('✅ Tabla notifications creada con índices optimizados');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índices primero
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notifications_org_user;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notifications_unread;`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_type;`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notifications_created;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notifications_severity;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notifications_expires;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notifications_organization;`,
    );

    // Eliminar tabla
    await queryRunner.query(`DROP TABLE IF EXISTS notifications;`);

    console.log('✅ Tabla notifications eliminada');
  }
}
