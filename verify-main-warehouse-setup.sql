-- verify-main-warehouse-setup.sql
-- Script de verificación para validar la configuración de almacenes principales

-- 1. Verificar que los campos existen
SELECT 
  'warehouses.is_main_warehouse' as field,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouses' AND column_name = 'is_main_warehouse'
  ) THEN '✅ Existe' ELSE '❌ No existe' END as status

UNION ALL

SELECT 
  'organizations.main_warehouse_id' as field,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'main_warehouse_id'
  ) THEN '✅ Existe' ELSE '❌ No existe' END as status;

-- 2. Verificar que todas las organizaciones activas tienen un almacén principal
SELECT 
  'Organizations without main warehouse' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '⚠️ Needs attention' END as status
FROM organizations o
LEFT JOIN warehouses w ON o.main_warehouse_id = w.id
WHERE o.is_active = TRUE 
  AND (o.main_warehouse_id IS NULL OR w.id IS NULL);

-- 3. Verificar que no hay organizaciones con múltiples almacenes principales
SELECT 
  'Organizations with multiple main warehouses' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ Error' END as status
FROM (
  SELECT organization_id, COUNT(*) as main_count
  FROM warehouses 
  WHERE is_main_warehouse = TRUE AND is_active = TRUE
  GROUP BY organization_id
  HAVING COUNT(*) > 1
) multiple_main;

-- 4. Verificar consistencia entre organization.main_warehouse_id y warehouse.is_main_warehouse
SELECT 
  'Inconsistent main warehouse references' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ Error' END as status
FROM organizations o
JOIN warehouses w ON o.main_warehouse_id = w.id
WHERE w.is_main_warehouse = FALSE OR w.is_active = FALSE;

-- 5. Mostrar resumen detallado por organización
SELECT 
  o.name as organization_name,
  o.slug as organization_slug,
  COUNT(w_all.id) as total_warehouses,
  COUNT(w_active.id) as active_warehouses,
  COUNT(w_main.id) as main_warehouses,
  COALESCE(w_main.name, 'Sin almacén principal') as main_warehouse_name,
  CASE 
    WHEN COUNT(w_main.id) = 0 THEN '❌ Sin almacén principal'
    WHEN COUNT(w_main.id) = 1 THEN '✅ Configurado correctamente'
    WHEN COUNT(w_main.id) > 1 THEN '❌ Múltiples almacenes principales'
  END as status
FROM organizations o
LEFT JOIN warehouses w_all ON w_all.organization_id = o.id
LEFT JOIN warehouses w_active ON w_active.organization_id = o.id AND w_active.is_active = TRUE
LEFT JOIN warehouses w_main ON w_main.organization_id = o.id AND w_main.is_main_warehouse = TRUE AND w_main.is_active = TRUE
WHERE o.is_active = TRUE
GROUP BY o.id, o.name, o.slug, w_main.name
ORDER BY o.name;

-- 6. Verificar índices
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('warehouses', 'organizations')
  AND indexname LIKE '%main_warehouse%'
ORDER BY tablename, indexname;

-- 7. Verificar constraints
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('warehouses', 'organizations')
  AND tc.constraint_name LIKE '%main_warehouse%'
ORDER BY tc.table_name, tc.constraint_name;