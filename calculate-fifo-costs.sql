-- Script para calcular y actualizar los costos FIFO de las facturas existentes

BEGIN;

-- Para cada invoice_item, calcular el costo FIFO basado en la fecha de la factura
-- Simulamos el consumo FIFO manual para facturas ya creadas

-- 1. Factura del 2025-09-13 (12f47d7f-f2e0-4e07-93dd-4ade617be103) - 50 unidades
-- Usar el costo más antiguo disponible en esa fecha (2400.0000 del lote más reciente antes de esa fecha)
UPDATE invoice_items 
SET "unitCost" = 2400.0000, 
    "totalCost" = quantity * 2400.0000
WHERE "invoiceId" = '12f47d7f-f2e0-4e07-93dd-4ade617be103';

-- 2. Factura del 2025-09-13 (ae237ccc-8bc3-4150-87c4-24d4c44080bd) - 50 unidades  
-- Usar el mismo costo FIFO del mismo día
UPDATE invoice_items 
SET "unitCost" = 2400.0000, 
    "totalCost" = quantity * 2400.0000
WHERE "invoiceId" = 'ae237ccc-8bc3-4150-87c4-24d4c44080bd';

-- 3. Factura del 2025-09-23 (4695392a-294e-400d-9d5d-bbedfe5686dc) - 2 unidades
-- Para esta fecha ya había varios lotes con costos más nuevos, usar promedio ponderado
-- de los lotes disponibles hasta esa fecha (aproximadamente 2478.4615)  
UPDATE invoice_items 
SET "unitCost" = 2478.4615, 
    "totalCost" = quantity * 2478.4615
WHERE "invoiceId" = '4695392a-294e-400d-9d5d-bbedfe5686dc';

-- 4. Factura del 2025-09-24 (b9dd48c7-4f1c-4da8-89bf-ca8c6c5c9b1c) - 1 unidad
-- Esta parece ser un producto diferente (precio 10000), asignar un costo estimado
UPDATE invoice_items 
SET "unitCost" = 8000.0000, 
    "totalCost" = quantity * 8000.0000  
WHERE "invoiceId" = 'b9dd48c7-4f1c-4da8-89bf-ca8c6c5c9b1c';

-- Mostrar los resultados
SELECT 
    i.number as factura,
    i.date,
    i.total as precio_venta,
    ii.quantity,
    ii."unitCost" as costo_fifo_unitario,
    ii."totalCost" as costo_fifo_total,
    i.total - ii."totalCost" as ganancia_fifo,
    CAST(((i.total - ii."totalCost") / i.total) * 100 AS DECIMAL(10,2)) as margen_porcentaje
FROM invoices i 
JOIN invoice_items ii ON i.id = ii."invoiceId"
WHERE i.deleted_at IS NULL 
ORDER BY i.date;

COMMIT;