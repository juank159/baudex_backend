-- ============================================================================
-- SOLO LECTURA. Ventas vendidas por PRESENTACIÓN (caja, cartón, paca...) que
-- llegaron al servidor SIN la presentación, y por eso descontaron unidades
-- sueltas en vez de la presentación completa (ej: 1 cartón de 30 huevos
-- descontó 1 huevo). Causa: la app no guardaba la presentación en las
-- ventas hechas sin internet (corregido en frontend fe51d52).
--
-- Cómo se reconoce una línea afectada:
--   * Tiene producto y NO tiene presentation_id.
--   * Su unidad es el nombre de una presentación de ese producto con
--     factor > 1 (la app pone como unidad el nombre de la presentación).
--
-- unidades_faltantes = lo que el inventario debió bajar y no bajó
--                    = cantidad × (factor − 1)
-- No modifica nada.
-- ============================================================================

-- 1) Detalle por línea de factura
SELECT
  o.name                                  AS negocio,
  i.number                                AS factura,
  i.date::date                            AS fecha,
  i.status                                AS estado_factura,
  ii.description                          AS producto,
  ii.unit                                 AS presentacion_vendida,
  pp.factor                               AS unidades_por_presentacion,
  ii.quantity                             AS cantidad_vendida,
  ii.quantity                             AS unidades_descontadas,
  ii.quantity * pp.factor                 AS unidades_que_debio_descontar,
  ii.quantity * (pp.factor - 1)           AS unidades_faltantes,
  ii."unitPrice"                          AS precio_vendido,
  pp.price                                AS precio_presentacion_hoy,
  -- 'si' = se cobró el precio de la presentación (caso seguro). 'no' =
  -- revisar a mano: el precio pudo cambiar después, o no fue esa presentación.
  CASE WHEN ABS(ii."unitPrice" - pp.price) < 1 THEN 'si' ELSE 'no' END
                                          AS precio_coincide,
  ii."productId"                          AS product_id,
  ii.id                                   AS invoice_item_id
FROM invoice_items ii
JOIN invoices i            ON i.id = ii."invoiceId"
JOIN organizations o       ON o.id = i.organization_id
JOIN product_presentations pp
  ON pp.product_id = ii."productId"
 AND pp.deleted_at IS NULL
 AND LOWER(TRIM(pp.name)) = LOWER(TRIM(ii.unit))
 AND pp.factor > 1
WHERE ii.deleted_at IS NULL
  AND i.deleted_at IS NULL
  AND ii."productId" IS NOT NULL
  AND ii.presentation_id IS NULL
ORDER BY o.name, i.date, i.number;

-- 2) Resumen por producto: cuánto inventario quedó de más en el sistema
--    (excluye facturas anuladas: al anular ya se devolvió lo descontado)
SELECT
  o.name                                  AS negocio,
  ii."productId"                          AS product_id,
  MIN(ii.description)                     AS producto,
  COUNT(*)                                AS lineas_afectadas,
  SUM(ii.quantity * (pp.factor - 1))      AS unidades_de_mas_en_sistema,
  SUM(ii.quantity * (pp.factor - 1))
    FILTER (WHERE ABS(ii."unitPrice" - pp.price) < 1)
                                          AS unidades_de_mas_casos_seguros
FROM invoice_items ii
JOIN invoices i            ON i.id = ii."invoiceId"
JOIN organizations o       ON o.id = i.organization_id
JOIN product_presentations pp
  ON pp.product_id = ii."productId"
 AND pp.deleted_at IS NULL
 AND LOWER(TRIM(pp.name)) = LOWER(TRIM(ii.unit))
 AND pp.factor > 1
WHERE ii.deleted_at IS NULL
  AND i.deleted_at IS NULL
  AND i.status <> 'cancelled'
  AND ii."productId" IS NOT NULL
  AND ii.presentation_id IS NULL
GROUP BY o.name, ii."productId"
ORDER BY o.name, unidades_de_mas_en_sistema DESC;

-- 3) Caso CONTRARIO (corregido en backend el 2026-10-25): devoluciones con
--    nota crédito de productos vendidos por presentación que devolvieron solo
--    la cantidad (1 caja devuelta sumó 1 unidad, no 12). Aquí el sistema
--    muestra MENOS inventario del real. En la copia del 19-oct: 0 casos.
SELECT
  o.name                                        AS negocio,
  MIN(ii.description)                           AS producto,
  COUNT(*)                                      AS devoluciones,
  SUM(cni.quantity * (ii.presentation_factor - 1)) AS unidades_que_faltan_en_sistema
FROM credit_note_items cni
JOIN credit_notes cn  ON cn.id = cni.credit_note_id
JOIN invoice_items ii ON ii.id = cni.invoice_item_id
JOIN invoices i       ON i.id = ii."invoiceId"
JOIN organizations o  ON o.id = i.organization_id
WHERE cn.status = 'confirmed'
  AND cn.inventory_restored = true
  AND cn.deleted_at IS NULL
  AND cni.deleted_at IS NULL
  AND cni.product_id IS NOT NULL
  AND ii.presentation_id IS NOT NULL
  AND ii.presentation_factor > 1
GROUP BY o.name, ii."productId"
ORDER BY unidades_que_faltan_en_sistema DESC;
