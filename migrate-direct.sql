-- Script para migrar productos con stock inicial
-- Identificar productos que necesitan migración

DO $$
DECLARE
    prod RECORD;
    batch_id UUID;
    movement_id UUID;
    batch_number VARCHAR(50);
    movement_number VARCHAR(50);
    unit_cost DECIMAL := 1000.00;
    total_cost DECIMAL;
    counter INT := 1;
BEGIN
    RAISE NOTICE 'Iniciando migración de stock inicial...';
    
    -- Recorrer productos con stock pero sin lotes
    FOR prod IN 
        SELECT p.id, p.name, p.sku, p.stock, p.organization_id
        FROM products p
        WHERE p.stock > 0 
          AND p.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM inventory_batches ib 
              WHERE ib.product_id = p.id AND ib.status = 'active'
          )
    LOOP
        RAISE NOTICE 'Migrando producto: % (Stock: %)', prod.name, prod.stock;
        
        -- Generar números únicos
        batch_number := 'BATCH-' || to_char(NOW(), 'YYYYMM') || '-' || LPAD(counter::text, 6, '0');
        movement_number := 'MOV-' || to_char(NOW(), 'YYYYMM') || '-' || LPAD(counter::text, 6, '0');
        counter := counter + 1;
        
        -- Calcular costo total
        total_cost := prod.stock * unit_cost;
        
        -- Generar IDs
        batch_id := gen_random_uuid();
        movement_id := gen_random_uuid();
        
        -- Crear lote de inventario
        INSERT INTO inventory_batches (
            id, batch_number, product_id, organization_id, 
            purchase_date, original_quantity, current_quantity, 
            reserved_quantity, unit_cost, total_cost, 
            remaining_value, status, metadata, 
            created_at, updated_at
        ) VALUES (
            batch_id, batch_number, prod.id, prod.organization_id,
            NOW(), prod.stock, prod.stock,
            0, unit_cost, total_cost,
            total_cost, 'active', 
            '{"source": "initial_stock_migration", "note": "Stock inicial migrado automáticamente"}',
            NOW(), NOW()
        );
        
        -- Crear movimiento de inventario
        INSERT INTO inventory_movements (
            id, movement_number, type, status, movement_date,
            quantity, unit_cost, total_cost, stock_after, 
            stock_value_after, reference_type, notes, 
            organization_id, product_id, created_by_id,
            created_at, updated_at
        ) VALUES (
            movement_id, movement_number, 'initial_stock', 'confirmed', NOW(),
            prod.stock, unit_cost, total_cost, prod.stock,
            total_cost, 'initial_stock', 'Migración de stock inicial automática',
            prod.organization_id, prod.id, '96e67dec-c329-430f-91c6-7cee0804656a',
            NOW(), NOW()
        );
        
        -- Crear relación batch-movement
        INSERT INTO inventory_batch_movements (
            id, type, batch_id, inventory_movement_id, organization_id,
            quantity, unit_cost, total_cost, 
            batch_quantity_after, batch_value_after,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'consume', batch_id, movement_id, prod.organization_id,
            prod.stock, unit_cost, total_cost,
            prod.stock, total_cost,
            NOW(), NOW()
        );
        
        RAISE NOTICE 'Producto migrado: % (Lote: %, Movimiento: %)', 
                     prod.name, batch_number, movement_number;
    END LOOP;
    
    RAISE NOTICE 'Migración completada exitosamente.';
END $$;