-- TRIGGERS PARA SINCRONIZACIÓN AUTOMÁTICA
-- Estos triggers mantienen products.stock siempre sincronizado con inventory_batches

-- ========================================
-- 1. FUNCIÓN PARA RECALCULAR STOCK
-- ========================================

CREATE OR REPLACE FUNCTION recalculate_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    product_uuid UUID;
    new_stock DECIMAL(10,2);
BEGIN
    -- Determinar el product_id según el tipo de operación
    IF TG_OP = 'DELETE' THEN
        product_uuid := OLD.product_id;
    ELSE
        product_uuid := COALESCE(NEW.product_id, OLD.product_id);
    END IF;
    
    -- Si no hay product_id, salir
    IF product_uuid IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calcular nuevo stock sumando todas las cantidades actuales de lotes activos
    SELECT COALESCE(SUM("currentQuantity"), 0)
    INTO new_stock
    FROM inventory_batches
    WHERE product_id = product_uuid 
      AND status = 'active'
      AND deleted_at IS NULL;
    
    -- Actualizar el stock del producto
    UPDATE products 
    SET 
        stock = new_stock,
        updated_at = NOW()
    WHERE id = product_uuid;
    
    -- Log para debugging
    RAISE NOTICE '🔄 SYNC: Producto % actualizado a stock %', product_uuid, new_stock;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. TRIGGER PARA CAMBIOS EN INVENTORY_BATCHES
-- ========================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS sync_product_stock_on_batch_change ON inventory_batches;

-- Crear trigger para cambios en lotes
CREATE TRIGGER sync_product_stock_on_batch_change
    AFTER INSERT OR UPDATE OR DELETE
    ON inventory_batches
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_product_stock();

-- ========================================
-- 3. FUNCIÓN PARA VALIDAR MOVIMIENTOS
-- ========================================

CREATE OR REPLACE FUNCTION validate_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
    product_uuid UUID;
    current_stock DECIMAL(10,2);
    batch_stock DECIMAL(10,2);
BEGIN
    product_uuid := NEW."productId";
    
    -- Obtener stock actual del producto
    SELECT stock INTO current_stock
    FROM products
    WHERE id = product_uuid;
    
    -- Obtener stock total de lotes activos
    SELECT COALESCE(SUM("currentQuantity"), 0)
    INTO batch_stock
    FROM inventory_batches
    WHERE product_id = product_uuid 
      AND status = 'active'
      AND deleted_at IS NULL;
    
    -- Si el movimiento es una salida (sale, waste, etc.)
    IF NEW.type IN ('sale', 'waste', 'transfer_out', 'return_out') THEN
        -- Validar que hay suficiente stock en lotes
        IF batch_stock < NEW.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente en lotes: disponible=%, requerido=%', 
                batch_stock, NEW.quantity;
        END IF;
    END IF;
    
    -- Actualizar stockAfter basado en el stock real de lotes
    IF NEW.type IN ('purchase', 'initial_stock', 'transfer_in', 'return_in', 'production') THEN
        NEW."stockAfter" := batch_stock + NEW.quantity;
    ELSIF NEW.type IN ('sale', 'waste', 'transfer_out', 'return_out') THEN
        NEW."stockAfter" := batch_stock - NEW.quantity;
    ELSE
        -- Para adjustments, usar el stock calculado
        NEW."stockAfter" := batch_stock;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. TRIGGER PARA VALIDAR MOVIMIENTOS
-- ========================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS validate_movement_before_insert ON inventory_movements;

-- Crear trigger para validar movimientos
CREATE TRIGGER validate_movement_before_insert
    BEFORE INSERT
    ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION validate_inventory_movement();

-- ========================================
-- 5. FUNCIÓN PARA SINCRONIZAR DESPUÉS DE MOVIMIENTOS
-- ========================================

CREATE OR REPLACE FUNCTION sync_after_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular stock del producto después de cualquier movimiento
    PERFORM recalculate_product_stock() FROM inventory_batches WHERE product_id = NEW."productId" LIMIT 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. TRIGGER PARA SINCRONIZAR DESPUÉS DE MOVIMIENTOS
-- ========================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS sync_after_inventory_movement ON inventory_movements;

-- Crear trigger para sincronizar después de movimientos
CREATE TRIGGER sync_after_inventory_movement
    AFTER INSERT OR UPDATE
    ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION sync_after_movement();

-- ========================================
-- 7. FUNCIÓN PARA PREVENIR MODIFICACIÓN DIRECTA DE STOCK
-- ========================================

CREATE OR REPLACE FUNCTION prevent_direct_stock_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Permitir modificaciones del sistema (cuando no hay session user o es el trigger)
    IF current_setting('application_name', true) = 'inventory_sync_trigger' THEN
        RETURN NEW;
    END IF;
    
    -- Si se está intentando modificar el stock directamente
    IF OLD.stock IS DISTINCT FROM NEW.stock THEN
        RAISE WARNING '⚠️ ADVERTENCIA: Modificación directa de stock no recomendada para producto %. Use movimientos de inventario.', NEW.name;
        -- Permitir la modificación pero con advertencia
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. TRIGGER PARA ADVERTIR SOBRE MODIFICACIONES DIRECTAS
-- ========================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS warn_direct_stock_modification ON products;

-- Crear trigger para advertir sobre modificaciones directas
CREATE TRIGGER warn_direct_stock_modification
    BEFORE UPDATE
    ON products
    FOR EACH ROW
    EXECUTE FUNCTION prevent_direct_stock_modification();

-- ========================================
-- CONFIRMACIÓN
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ TRIGGERS DE SINCRONIZACIÓN CREADOS EXITOSAMENTE';
    RAISE NOTICE '================================================';
    RAISE NOTICE '- Trigger: sync_product_stock_on_batch_change';
    RAISE NOTICE '- Trigger: validate_movement_before_insert';
    RAISE NOTICE '- Trigger: sync_after_inventory_movement';
    RAISE NOTICE '- Trigger: warn_direct_stock_modification';
    RAISE NOTICE '';
    RAISE NOTICE '🛡️ El sistema ahora mantiene sincronización automática';
    RAISE NOTICE '   entre products.stock e inventory_batches';
END $$;