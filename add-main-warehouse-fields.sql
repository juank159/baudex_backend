-- add-main-warehouse-fields.sql
-- Script para agregar campos de almacén principal y migrar datos existentes

-- Paso 1: Agregar campo isMainWarehouse a warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_main_warehouse BOOLEAN DEFAULT FALSE;

-- Paso 2: Agregar campo mainWarehouseId a organizations  
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS main_warehouse_id UUID;

-- Paso 3: Para organizaciones que solo tienen UN almacén, marcarlo como principal
UPDATE warehouses 
SET is_main_warehouse = TRUE 
WHERE id IN (
  SELECT w.id 
  FROM warehouses w
  WHERE w.organization_id IN (
    SELECT organization_id 
    FROM warehouses 
    WHERE is_active = TRUE
    GROUP BY organization_id 
    HAVING COUNT(*) = 1
  )
  AND w.is_active = TRUE
);

-- Paso 4: Para organizaciones con múltiples almacenes, marcar el más antiguo como principal
UPDATE warehouses 
SET is_main_warehouse = TRUE 
WHERE id IN (
  SELECT DISTINCT ON (organization_id) id
  FROM warehouses 
  WHERE is_active = TRUE 
    AND organization_id IN (
      SELECT organization_id 
      FROM warehouses 
      WHERE is_active = TRUE
      GROUP BY organization_id 
      HAVING COUNT(*) > 1
    )
  ORDER BY organization_id, created_at ASC
);

-- Paso 5: Actualizar organizations.main_warehouse_id con el almacén principal
UPDATE organizations 
SET main_warehouse_id = (
  SELECT id 
  FROM warehouses 
  WHERE warehouses.organization_id = organizations.id 
    AND is_main_warehouse = TRUE 
    AND is_active = TRUE
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 
  FROM warehouses 
  WHERE warehouses.organization_id = organizations.id 
    AND is_main_warehouse = TRUE 
    AND is_active = TRUE
);

-- Paso 6: Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_warehouses_is_main_warehouse ON warehouses(organization_id, is_main_warehouse) WHERE is_main_warehouse = TRUE;
CREATE INDEX IF NOT EXISTS idx_organizations_main_warehouse_id ON organizations(main_warehouse_id) WHERE main_warehouse_id IS NOT NULL;

-- Paso 7: Agregar constraint para asegurar solo un almacén principal por organización
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS unique_main_warehouse_per_organization;
ALTER TABLE warehouses ADD CONSTRAINT unique_main_warehouse_per_organization 
  EXCLUDE (organization_id WITH =) WHERE (is_main_warehouse = TRUE AND is_active = TRUE);

-- Verificación: Mostrar resultados de la migración
SELECT 
  o.name as organization_name,
  o.slug as organization_slug,
  w.name as main_warehouse_name,
  w.code as main_warehouse_code,
  w.is_main_warehouse,
  CASE 
    WHEN o.main_warehouse_id = w.id THEN '✅ Consistente'
    ELSE '❌ Inconsistente'
  END as status
FROM organizations o
LEFT JOIN warehouses w ON o.main_warehouse_id = w.id
ORDER BY o.name;

-- Mostrar estadísticas
SELECT 
  'Total Organizations' as metric,
  COUNT(*) as count
FROM organizations
UNION ALL
SELECT 
  'Organizations with Main Warehouse',
  COUNT(*) 
FROM organizations 
WHERE main_warehouse_id IS NOT NULL
UNION ALL  
SELECT 
  'Total Warehouses',
  COUNT(*)
FROM warehouses 
WHERE is_active = TRUE
UNION ALL
SELECT 
  'Main Warehouses',
  COUNT(*)
FROM warehouses 
WHERE is_main_warehouse = TRUE AND is_active = TRUE;