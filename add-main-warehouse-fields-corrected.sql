-- add-main-warehouse-fields-corrected.sql
-- Script para agregar campos de almacén principal (corregido para camelCase)

-- Paso 1: Agregar campo isMainWarehouse a warehouses (ya existe)
-- ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS "isMainWarehouse" BOOLEAN DEFAULT FALSE;

-- Paso 2: Agregar campo mainWarehouseId a organizations (ya existe)  
-- ALTER TABLE organizations ADD COLUMN IF NOT EXISTS "mainWarehouseId" UUID;

-- Paso 3: Para organizaciones que solo tienen UN almacén, marcarlo como principal
UPDATE warehouses 
SET "isMainWarehouse" = TRUE 
WHERE id IN (
  SELECT w.id 
  FROM warehouses w
  WHERE w."organizationId" IN (
    SELECT "organizationId" 
    FROM warehouses 
    WHERE "isActive" = TRUE
    GROUP BY "organizationId" 
    HAVING COUNT(*) = 1
  )
  AND w."isActive" = TRUE
);

-- Paso 4: Para organizaciones con múltiples almacenes, marcar el más antiguo como principal
UPDATE warehouses 
SET "isMainWarehouse" = TRUE 
WHERE id IN (
  SELECT DISTINCT ON ("organizationId") id
  FROM warehouses 
  WHERE "isActive" = TRUE 
    AND "organizationId" IN (
      SELECT "organizationId" 
      FROM warehouses 
      WHERE "isActive" = TRUE
      GROUP BY "organizationId" 
      HAVING COUNT(*) > 1
    )
  ORDER BY "organizationId", "createdAt" ASC
);

-- Paso 5: Actualizar organizations.mainWarehouseId con el almacén principal
UPDATE organizations 
SET "mainWarehouseId" = (
  SELECT id 
  FROM warehouses 
  WHERE warehouses."organizationId" = organizations.id 
    AND "isMainWarehouse" = TRUE 
    AND "isActive" = TRUE
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 
  FROM warehouses 
  WHERE warehouses."organizationId" = organizations.id 
    AND "isMainWarehouse" = TRUE 
    AND "isActive" = TRUE
);

-- Paso 6: Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_warehouses_is_main_warehouse ON warehouses("organizationId", "isMainWarehouse") WHERE "isMainWarehouse" = TRUE;
CREATE INDEX IF NOT EXISTS idx_organizations_main_warehouse_id ON organizations("mainWarehouseId") WHERE "mainWarehouseId" IS NOT NULL;

-- Verificación: Mostrar resultados de la migración
SELECT 
  o.name as organization_name,
  o.slug as organization_slug,
  w.name as main_warehouse_name,
  w.code as main_warehouse_code,
  w."isMainWarehouse",
  CASE 
    WHEN o."mainWarehouseId" = w.id THEN '✅ Consistente'
    ELSE '❌ Inconsistente'
  END as status
FROM organizations o
LEFT JOIN warehouses w ON o."mainWarehouseId" = w.id
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
WHERE "mainWarehouseId" IS NOT NULL
UNION ALL  
SELECT 
  'Total Warehouses',
  COUNT(*)
FROM warehouses 
WHERE "isActive" = TRUE
UNION ALL
SELECT 
  'Main Warehouses',
  COUNT(*)
FROM warehouses 
WHERE "isMainWarehouse" = TRUE AND "isActive" = TRUE;