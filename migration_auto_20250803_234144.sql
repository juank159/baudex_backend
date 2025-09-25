-- ============================================================================
-- MIGRACIÓN AUTOMÁTICA: LA GRANADA
-- Generado automáticamente el 2025-08-03 23:41:44
-- Organización ID: 7b3fa424-c417-49b0-9013-8e4c39d82890
-- ============================================================================

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Crear organización
BEGIN;
INSERT INTO organizations (
    id, created_at, updated_at, name, slug, domain, "isActive", 
    currency, locale, timezone, settings
) VALUES (
    '7b3fa424-c417-49b0-9013-8e4c39d82890',
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

