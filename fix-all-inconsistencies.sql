-- CORRECCIÓN COMPLETA DE INCONSISTENCIAS
-- Este script corrige TODAS las inconsistencias del sistema

DO $$
DECLARE
    product_record RECORD;
    batch_record RECORD;
    product_stock DECIMAL;
    batch_total DECIMAL;
    difference DECIMAL;
    correction_needed BOOLEAN;
    batch_id UUID;
    movement_id UUID;
    user_id UUID := '3db107b3-23d3-4ddb-8de4-5dcbf8eb0e8f'; -- Admin user
    org_id UUID;
BEGIN
    RAISE NOTICE '🚀 INICIANDO CORRECCIÓN COMPLETA DE INCONSISTENCIAS';
    RAISE NOTICE '================================================';
    
    -- Obtener organización
    SELECT organization_id INTO org_id FROM users WHERE id = user_id;
    
    -- Recorrer TODOS los productos con stock
    FOR product_record IN 
        SELECT 
            p.id,
            p.name,
            p.stock,
            p.organization_id,
            COALESCE(SUM(ib."currentQuantity"), 0) as batch_total
        FROM products p
        LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.status = 'active'
        WHERE p.deleted_at IS NULL
        GROUP BY p.id, p.name, p.stock, p.organization_id
        HAVING p.stock != COALESCE(SUM(ib."currentQuantity"), 0)
    LOOP
        product_stock := product_record.stock;
        batch_total := product_record.batch_total;
        difference := product_stock - batch_total;
        
        RAISE NOTICE '🔍 INCONSISTENCIA DETECTADA:';
        RAISE NOTICE '   Producto: %', product_record.name;
        RAISE NOTICE '   Stock producto: %', product_stock;
        RAISE NOTICE '   Total lotes: %', batch_total;
        RAISE NOTICE '   Diferencia: %', difference;
        
        IF difference > 0 THEN
            -- Caso 1: Producto tiene más stock que lotes (falta crear lote)
            RAISE NOTICE '   ✅ SOLUCIÓN: Crear lote por diferencia de %', difference;
            
            batch_id := gen_random_uuid();
            movement_id := gen_random_uuid();
            
            -- Crear lote faltante
            INSERT INTO inventory_batches (
                id, "batchNumber", product_id, organization_id,
                "purchaseDate", "originalQuantity", "currentQuantity",
                "reservedQuantity", "unitCost", "totalCost",
                "remainingValue", status, metadata,
                created_at, updated_at
            ) VALUES (
                batch_id, 
                'BATCH-FIX-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(product_record.id::text, 1, 8),
                product_record.id, 
                product_record.organization_id,
                NOW(), 
                difference, 
                difference,
                0, 
                1000.00, 
                difference * 1000.00,
                difference * 1000.00, 
                'active', 
                '{"source": "inconsistency_fix", "reason": "Ajuste por inconsistencia de stock", "original_difference": ' || difference || '}',
                NOW(), 
                NOW()
            );
            
            -- Crear movimiento de ajuste
            INSERT INTO inventory_movements (
                id, "movementNumber", type, status, "movementDate",
                quantity, "unitCost", "totalCost", "stockAfter",
                "stockValueAfter", "referenceType", notes,
                organization_id, "productId", "createdById",
                created_at, updated_at
            ) VALUES (
                movement_id, 
                'MOV-FIX-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(product_record.id::text, 1, 8),
                'adjustment', 
                'confirmed', 
                NOW(),
                difference, 
                1000.00, 
                difference * 1000.00, 
                product_stock,
                product_stock * 1000.00, 
                'inconsistency_fix', 
                'Ajuste automático por inconsistencia de stock',
                product_record.organization_id, 
                product_record.id, 
                user_id,
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
                product_record.organization_id,
                difference, 
                1000.00, 
                difference * 1000.00,
                difference, 
                difference * 1000.00,
                NOW(), 
                NOW()
            );
            
        ELSIF difference < 0 THEN
            -- Caso 2: Lotes tienen más cantidad que el producto (reducir lotes FIFO)
            RAISE NOTICE '   ✅ SOLUCIÓN: Reducir lotes por exceso de %', ABS(difference);
            
            -- Reducir lotes usando FIFO (más antiguos primero)
            FOR batch_record IN
                SELECT 
                    ib.id,
                    ib."batchNumber",
                    ib."currentQuantity",
                    ib."purchaseDate"
                FROM inventory_batches ib
                WHERE ib.product_id = product_record.id 
                  AND ib.status = 'active'
                  AND ib."currentQuantity" > 0
                ORDER BY ib."purchaseDate" ASC, ib.created_at ASC
            LOOP
                EXIT WHEN difference >= 0;
                
                DECLARE
                    reduction_qty DECIMAL;
                    new_batch_qty DECIMAL;
                BEGIN
                    reduction_qty := LEAST(batch_record."currentQuantity", ABS(difference));
                    new_batch_qty := batch_record."currentQuantity" - reduction_qty;
                    
                    RAISE NOTICE '     - Reduciendo lote % en % unidades (de % a %)', 
                        batch_record."batchNumber", reduction_qty, 
                        batch_record."currentQuantity", new_batch_qty;
                    
                    -- Actualizar cantidad del lote
                    UPDATE inventory_batches 
                    SET 
                        "currentQuantity" = new_batch_qty,
                        "remainingValue" = new_batch_qty * "unitCost",
                        updated_at = NOW()
                    WHERE id = batch_record.id;
                    
                    -- Si el lote queda en 0, marcarlo como depleted
                    IF new_batch_qty = 0 THEN
                        UPDATE inventory_batches 
                        SET status = 'depleted'
                        WHERE id = batch_record.id;
                    END IF;
                    
                    difference := difference + reduction_qty;
                END;
            END LOOP;
            
            -- Crear movimiento de ajuste por la reducción total
            movement_id := gen_random_uuid();
            INSERT INTO inventory_movements (
                id, "movementNumber", type, status, "movementDate",
                quantity, "unitCost", "totalCost", "stockAfter",
                "stockValueAfter", "referenceType", notes,
                organization_id, "productId", "createdById",
                created_at, updated_at
            ) VALUES (
                movement_id, 
                'MOV-FIX-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(product_record.id::text, 1, 8),
                'adjustment', 
                'confirmed', 
                NOW(),
                (batch_total - product_stock) * -1, -- Negativo porque es reducción
                1000.00, 
                (batch_total - product_stock) * -1000.00, 
                product_stock,
                product_stock * 1000.00, 
                'inconsistency_fix', 
                'Ajuste automático por exceso de lotes',
                product_record.organization_id, 
                product_record.id, 
                user_id,
                NOW(), 
                NOW()
            );
        END IF;
        
        RAISE NOTICE '   ✅ INCONSISTENCIA CORREGIDA PARA: %', product_record.name;
        RAISE NOTICE '';
        
    END LOOP;
    
    RAISE NOTICE '🎉 CORRECCIÓN COMPLETA FINALIZADA';
    RAISE NOTICE '==================================';
    
END $$;