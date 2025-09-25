-- ============================================================================
-- MIGRACIÓN AUTOMÁTICA: LA GRANADA
-- Generado automáticamente el 2025-08-03 23:56:47
-- Organización ID: 7df0997a-9c94-4883-b968-98c8cb555528
-- ============================================================================

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Crear organización
BEGIN;
INSERT INTO organizations (
    id, created_at, updated_at, name, slug, domain, "isActive", 
    currency, locale, timezone, settings
) VALUES (
    '7df0997a-9c94-4883-b968-98c8cb555528',
    NOW(),
    NOW(),
    'La Granada',
    'la-granada',
    'la-granada.legacy',
    true,
    'COP',
    'es',
    'America/Bogota',
    '{"migrated": true, "source": "backup_granada.sql", "auto_generated": true}'::jsonb
) ON CONFLICT (id) DO NOTHING;
COMMIT;

