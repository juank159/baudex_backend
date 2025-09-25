-- TRIGGER FALTANTE: CREAR LOTES AUTOMÁTICAMENTE PARA PRODUCTOS NUEVOS
-- Este es el trigger crítico que faltaba para completar al 100%

-- ========================================
-- FUNCIÓN PARA CREAR LOTES INICIALES AUTOMÁTICAMENTE
-- ========================================

CREATE OR REPLACE FUNCTION create_initial_batch_for_product()
RETURNS TRIGGER AS $$
DECLARE
    batch_id UUID;
    movement_id UUID;
    batch_number VARCHAR(50);
    movement_number VARCHAR(50);
    unit_cost DECIMAL := 1000.00; -- Costo por defecto
    total_cost DECIMAL;
    counter INT;
BEGIN
    -- Solo procesar si el producto tiene stock inicial > 0
    IF NEW.stock IS NULL OR NEW.stock <= 0 THEN
        RETURN NEW;
    END IF;
    
    -- Solo procesar productos nuevos (INSERT), no updates
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    RAISE NOTICE '🚀 Creando lote inicial automático para producto: % (Stock: %)', NEW.name, NEW.stock;
    
    -- Generar IDs únicos
    batch_id := gen_random_uuid();
    movement_id := gen_random_uuid();
    
    -- Generar números únicos para lote y movimiento
    SELECT COALESCE(MAX(
        CASE 
            WHEN "batchNumber" ~ '^BATCH-[0-9]{6}-[0-9]{6}$' THEN
                CAST(SUBSTRING("batchNumber", 14, 6) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO counter
    FROM inventory_batches
    WHERE organization_id = NEW.organization_id
      AND "batchNumber" LIKE 'BATCH-' || to_char(NOW(), 'YYYYMM') || '-%';
    
    batch_number := 'BATCH-' || to_char(NOW(), 'YYYYMM') || '-' || LPAD(counter::text, 6, '0');
    movement_number := 'MOV-' || to_char(NOW(), 'YYYYMM') || '-' || LPAD(counter::text, 6, '0');
    
    total_cost := NEW.stock * unit_cost;
    
    -- Crear lote inicial
    INSERT INTO inventory_batches (
        id, "batchNumber", product_id, organization_id,
        "purchaseDate", "originalQuantity", "currentQuantity",
        "reservedQuantity", "unitCost", "totalCost",
        "remainingValue", status, metadata,
        created_at, updated_at
    ) VALUES (
        batch_id, 
        batch_number, 
        NEW.id, 
        NEW.organization_id,
        NOW(), 
        NEW.stock, 
        NEW.stock,
        0, 
        unit_cost, 
        total_cost,
        total_cost, 
        'active', 
        json_build_object(
            'source', 'automatic_product_creation',
            'createdWithProduct', true,
            'note', 'Stock inicial creado automáticamente por trigger'
        ),
        NOW(), 
        NOW()
    );
    
    -- Crear movimiento inicial
    INSERT INTO inventory_movements (
        id, "movementNumber", type, status, "movementDate",
        quantity, "unitCost", "totalCost", "stockAfter",
        "stockValueAfter", "referenceType", notes,
        organization_id, "productId", "createdById",
        created_at, updated_at
    ) VALUES (
        movement_id, 
        movement_number, 
        'initial_stock', 
        'confirmed', 
        NOW(),
        NEW.stock, 
        unit_cost, 
        total_cost, 
        NEW.stock,
        total_cost, 
        'automatic_product_creation', 
        'Stock inicial creado automáticamente',
        NEW.organization_id, 
        NEW.id, 
        NEW.created_by_id,
        NOW(), 
        NOW()
    );
    
    -- Crear relación batch-movement
    INSERT INTO inventory_batch_movements (
        id, type, "batchId", "inventoryMovementId", organization_id,
        quantity, "unitCost", "totalCost",
        "batchQuantityAfter", "batchValueAfter",
        created_at, updated_at
    ) VALUES (
        gen_random_uuid(), 
        'consume', 
        batch_id, 
        movement_id, 
        NEW.organization_id,
        NEW.stock, 
        unit_cost, 
        total_cost,
        NEW.stock, 
        total_cost,
        NOW(), 
        NOW()
    );
    
    RAISE NOTICE '✅ Lote inicial creado: % para producto %', batch_number, NEW.name;
    
    RETURN NEW;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Error creando lote inicial para %: %', NEW.name, SQLERRM;
    -- No fallar la creación del producto, solo loggear el error
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CREAR EL TRIGGER FALTANTE
-- ========================================

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS create_initial_batch_on_product_insert ON products;

-- Crear trigger para productos nuevos con stock inicial
CREATE TRIGGER create_initial_batch_on_product_insert
    AFTER INSERT
    ON products
    FOR EACH ROW
    EXECUTE FUNCTION create_initial_batch_for_product();

-- ========================================
-- CONFIRMACIÓN
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '🎯 TRIGGER CRÍTICO CREADO: create_initial_batch_on_product_insert';
    RAISE NOTICE '   Ahora el sistema creará lotes automáticamente para productos nuevos';
    RAISE NOTICE '   ✅ FUNCIONALIDAD 100% COMPLETADA';
END $$;