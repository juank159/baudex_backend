-- Script manual para expirar suscripciones vencidas
-- Ejecutar este script si quieres actualizar manualmente las suscripciones que ya vencieron

-- 1. Ver suscripciones que están activas pero ya vencieron
SELECT 
    s.id,
    s.plan,
    s.status,
    s.start_date,
    s.end_date,
    s.is_active,
    o.name as organization_name,
    o.slug as organization_slug,
    (s.end_date < NOW()) as is_expired
FROM subscriptions s
JOIN organizations o ON s.organization_id = o.id
WHERE s.status = 'active' 
  AND s.is_active = true 
  AND s.end_date < NOW()
ORDER BY s.end_date DESC;

-- 2. Actualizar suscripciones expiradas (UNCOMMENT TO RUN)
/*
UPDATE subscriptions 
SET 
    status = 'expired',
    is_active = false,
    updated_at = NOW()
WHERE 
    status = 'active' 
    AND is_active = true 
    AND end_date < NOW();
*/

-- 3. Verificar el resultado
/*
SELECT 
    s.plan,
    s.status,
    COUNT(*) as count
FROM subscriptions s
GROUP BY s.plan, s.status
ORDER BY s.plan, s.status;
*/