-- =====================================================
-- MIGRACIÓN: Agregar tabla dynamic_notification_states
-- Fecha: 2026-02-02
-- Descripción: Tabla para persistir el estado de lectura
--              de notificaciones dinámicas generadas por el dashboard
-- =====================================================

-- Crear tabla para estados de notificaciones dinámicas
CREATE TABLE IF NOT EXISTS dynamic_notification_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dynamic_notification_id VARCHAR(255) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraint único para evitar duplicados
    CONSTRAINT unique_dynamic_notification_state
        UNIQUE (dynamic_notification_id, user_id, organization_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_dynamic_notification_states_org_user
    ON dynamic_notification_states(organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_notification_states_user_read
    ON dynamic_notification_states(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_dynamic_notification_states_notification_id
    ON dynamic_notification_states(dynamic_notification_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_notification_states_org
    ON dynamic_notification_states(organization_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_notification_states_user
    ON dynamic_notification_states(user_id);

-- Comentarios de documentación
COMMENT ON TABLE dynamic_notification_states IS
    'Almacena el estado de lectura de notificaciones dinámicas generadas en tiempo real por el dashboard';

COMMENT ON COLUMN dynamic_notification_states.dynamic_notification_id IS
    'ID de la notificación dinámica (ej: stock_abc123, invoice_xyz789)';

COMMENT ON COLUMN dynamic_notification_states.is_read IS
    'Indica si la notificación ha sido leída por el usuario';

COMMENT ON COLUMN dynamic_notification_states.read_at IS
    'Timestamp de cuando la notificación fue marcada como leída';

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_dynamic_notification_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dynamic_notification_states_updated_at
    ON dynamic_notification_states;

CREATE TRIGGER trigger_update_dynamic_notification_states_updated_at
    BEFORE UPDATE ON dynamic_notification_states
    FOR EACH ROW
    EXECUTE FUNCTION update_dynamic_notification_states_updated_at();

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
