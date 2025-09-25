-- Inicialización de la base de datos para el sistema PEPS/FIFO
-- Este script se ejecuta automáticamente cuando se crea el container de PostgreSQL

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Configurar timezone
SET timezone = 'America/Bogota';

-- Crear esquema por defecto si no existe
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE baudex TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;

-- Comentarios informativos
COMMENT ON DATABASE baudex IS 'Base de datos del sistema PEPS/FIFO - Baudex';
COMMENT ON EXTENSION "uuid-ossp" IS 'Extensión para generar UUIDs automáticamente';
COMMENT ON EXTENSION "pg_trgm" IS 'Extensión para búsquedas de texto mejoradas';

-- Configuraciones de performance para desarrollo
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Reload configuration
SELECT pg_reload_conf();