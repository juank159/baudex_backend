-- rollback-main-warehouse-fields.sql
-- Script para revertir los cambios de almacén principal

-- ADVERTENCIA: Este script eliminará los campos agregados
-- Solo usar si hay problemas con la migración

-- Paso 1: Eliminar constraint
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS unique_main_warehouse_per_organization;

-- Paso 2: Eliminar índices
DROP INDEX IF EXISTS idx_warehouses_is_main_warehouse;
DROP INDEX IF EXISTS idx_organizations_main_warehouse_id;

-- Paso 3: Eliminar campo main_warehouse_id de organizations
ALTER TABLE organizations DROP COLUMN IF EXISTS main_warehouse_id;

-- Paso 4: Eliminar campo is_main_warehouse de warehouses
ALTER TABLE warehouses DROP COLUMN IF EXISTS is_main_warehouse;

-- Verificación: Confirmar que los campos fueron eliminados
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
  AND column_name IN ('is_main_warehouse');

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND column_name IN ('main_warehouse_id');