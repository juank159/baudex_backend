-- Script de renovación de suscripción para organización c99d0fd8-667b-4b8b-a52b-10380fbbf611
-- Cambiar de TRIAL vencido a BASIC por 1 mes

-- 1. PRIMERO - Ver el estado actual
SELECT 
    'ESTADO ACTUAL - ORGANIZACION' as info,
    id, name, slug,
    subscription_plan, subscription_status,
    subscription_start_date, subscription_end_date,
    trial_start_date, trial_end_date
FROM organizations 
WHERE id = 'c99d0fd8-667b-4b8b-a52b-10380fbbf611';

SELECT 
    'ESTADO ACTUAL - SUSCRIPCIONES' as info,
    s.id, s.plan, s.status, s.is_active,
    s.start_date, s.end_date, s.trial_ends_at,
    s.created_at, s.updated_at
FROM subscriptions s
WHERE s.organization_id = 'c99d0fd8-667b-4b8b-a52b-10380fbbf611'
ORDER BY s.created_at DESC;

-- 2. DESACTIVAR suscripciones anteriores (trial vencido)
UPDATE subscriptions 
SET 
    status = 'expired',
    is_active = false,
    updated_at = NOW()
WHERE 
    organization_id = 'c99d0fd8-667b-4b8b-a52b-10380fbbf611'
    AND status != 'expired';

-- 3. CREAR nueva suscripción BASIC por 1 mes
INSERT INTO subscriptions (
    id,
    organization_id,
    plan,
    status,
    start_date,
    end_date,
    trial_ends_at,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'c99d0fd8-667b-4b8b-a52b-10380fbbf611',
    'basic',
    'active',
    NOW(),
    NOW() + INTERVAL '1 month',
    NULL,
    true,
    NOW(),
    NOW()
);

-- 4. ACTUALIZAR campos legacy en organizations (si existen)
UPDATE organizations 
SET 
    subscription_plan = 'basic',
    subscription_status = 'active',
    subscription_start_date = NOW(),
    subscription_end_date = NOW() + INTERVAL '1 month',
    trial_start_date = NULL,
    trial_end_date = NULL,
    updated_at = NOW()
WHERE id = 'c99d0fd8-667b-4b8b-a52b-10380fbbf611';

-- 5. VERIFICAR el resultado final
SELECT 
    'RESULTADO FINAL - ORGANIZACION' as info,
    id, name, slug,
    subscription_plan, subscription_status,
    subscription_start_date, subscription_end_date,
    trial_start_date, trial_end_date
FROM organizations 
WHERE id = 'c99d0fd8-667b-4b8b-a52b-10380fbbf611';

SELECT 
    'RESULTADO FINAL - SUSCRIPCIONES' as info,
    s.id, s.plan, s.status, s.is_active,
    s.start_date, s.end_date, s.trial_ends_at,
    s.created_at, s.updated_at
FROM subscriptions s
WHERE s.organization_id = 'c99d0fd8-667b-4b8b-a52b-10380fbbf611'
ORDER BY s.created_at DESC;

-- 6. RESUMEN de cambios realizados
SELECT 
    'RESUMEN DE CAMBIOS REALIZADOS' as info,
    '1. Suscripción anterior marcada como expired' as cambio_1,
    '2. Nueva suscripción basic creada por 1 mes' as cambio_2,
    '3. Campos legacy en organizations actualizados' as cambio_3,
    NOW() as fecha_actualizacion;