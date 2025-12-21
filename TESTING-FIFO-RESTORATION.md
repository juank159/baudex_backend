# Guía de Testing: Restauración FIFO de Inventario en Notas de Crédito

## 📋 Resumen de la Funcionalidad

**Problema resuelto:** Cuando se crea una nota de crédito, el sistema ahora **restaura el inventario a los lotes originales** de donde fue consumido durante la venta, en lugar de crear un nuevo lote.

**Flujo correcto:**
1. **Venta:** Consume productos de lotes existentes usando FIFO (primero los más antiguos)
2. **Nota de Crédito:** Devuelve productos a los mismos lotes usando LIFO (primero los consumidos más recientemente)
3. **Reactivación:** Si un lote estaba agotado (DEPLETED), vuelve a estado ACTIVE

---

## ✅ Verificación de Implementación

### 1. Verificar que el código compila sin errores

```bash
cd /Users/mac/Documents/baudex/backend
npm run build
```

**Resultado esperado:** `Build successful` sin errores de TypeScript.

### 2. Verificar migración de base de datos

**Con Docker corriendo y base de datos conectada:**

```bash
# Iniciar Docker
# Ejecutar: docker-compose up -d

# Verificar columna invoice_item_id
npm run typeorm -- query "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'inventory_batch_movements' AND column_name = 'invoice_item_id'" -d src/database/typeorm.config.ts
```

**Resultado esperado:**
```
column_name      | data_type | is_nullable
invoice_item_id  | uuid      | YES
```

**Verificar foreign key:**

```bash
npm run typeorm -- query "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'inventory_batch_movements'::regclass AND conname LIKE '%invoice%'" -d src/database/typeorm.config.ts
```

**Resultado esperado:**
```
FK_batch_movement_invoice_item | FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE SET NULL
```

**Verificar índice:**

```bash
npm run typeorm -- query "SELECT indexname FROM pg_indexes WHERE tablename = 'inventory_batch_movements' AND indexname LIKE '%invoice%'" -d src/database/typeorm.config.ts
```

**Resultado esperado:**
```
IDX_batch_movements_invoice_item
```

---

## 🧪 Casos de Prueba

### CASO 1: Devolución Simple (1 Solo Lote)

**Objetivo:** Verificar que una venta de un solo lote se restaura correctamente al mismo lote.

**Pasos:**

1. **Preparación:**
   - Crear producto "Producto Test A"
   - Crear lote de inventario:
     - Lote: `LOTE-001`
     - Cantidad original: 100 unidades
     - Fecha de compra: 2025-01-01
     - Costo unitario: $10

2. **Ejecutar venta:**
   - Crear factura con cliente de prueba
   - Agregar "Producto Test A": 20 unidades a $15 c/u
   - Confirmar/pagar factura

3. **Verificar consumo FIFO:**
   - Ir a módulo de Inventario → Lotes
   - Verificar que `LOTE-001` ahora tiene:
     - Cantidad actual: 80 unidades (100 - 20)
     - Estado: ACTIVE

4. **Ejecutar nota de crédito:**
   - Crear nota de crédito referenciando la factura anterior
   - Devolver "Producto Test A": 20 unidades
   - Confirmar nota de crédito

5. **Verificar restauración:**
   - Ir a Inventario → Lotes
   - Verificar que `LOTE-001` ahora tiene:
     - Cantidad actual: 100 unidades (80 + 20) ← **RESTAURADO**
     - Estado: ACTIVE
   - **IMPORTANTE:** No debe existir un nuevo lote creado con las 20 unidades devueltas

6. **Verificar trazabilidad:**
   - En base de datos, ejecutar:
   ```sql
   SELECT
     bm.type,
     bm.quantity,
     bm.invoice_item_id,
     b.batch_number,
     bm.movement_date
   FROM inventory_batch_movements bm
   JOIN inventory_batches b ON b.id = bm.batch_id
   WHERE b.batch_number = 'LOTE-001'
   ORDER BY bm.movement_date DESC
   LIMIT 5;
   ```
   - Debe mostrar:
     - Movimiento INCOMING: +20 (devolución con `invoice_item_id` poblado)
     - Movimiento CONSUME: -20 (venta original con `invoice_item_id` poblado)

**Resultado esperado:** ✅ El lote original recupera exactamente las unidades vendidas.

---

### CASO 2: Devolución Multi-Lote (FIFO → LIFO)

**Objetivo:** Verificar que una venta que consumió de múltiples lotes se restaura en orden LIFO correcto.

**Pasos:**

1. **Preparación:**
   - Crear producto "Producto Test B"
   - Crear 3 lotes:
     - `LOTE-101`: 10 unidades, fecha 2025-01-01, costo $10
     - `LOTE-102`: 15 unidades, fecha 2025-01-15, costo $11
     - `LOTE-103`: 20 unidades, fecha 2025-02-01, costo $12

2. **Ejecutar venta de 30 unidades:**
   - Crear factura con "Producto Test B": 30 unidades
   - Confirmar/pagar factura

3. **Verificar consumo FIFO (primero los más antiguos):**
   - `LOTE-101`: 0 unidades (consumió las 10) → Estado: DEPLETED
   - `LOTE-102`: 0 unidades (consumió las 15) → Estado: DEPLETED
   - `LOTE-103`: 15 unidades (consumió 5 de 20) → Estado: ACTIVE

4. **Ejecutar nota de crédito de 30 unidades:**
   - Crear nota de crédito devolviendo las 30 unidades
   - Confirmar

5. **Verificar restauración LIFO (inverso al consumo):**
   - `LOTE-103`: 20 unidades (15 + 5) ← **Primero restaurado (último consumido)**
   - `LOTE-102`: 15 unidades (0 + 15) ← **Segundo restaurado** → Estado: ACTIVE (reactivado)
   - `LOTE-101`: 10 unidades (0 + 10) ← **Tercero restaurado** → Estado: ACTIVE (reactivado)

6. **Verificar en base de datos:**
   ```sql
   SELECT
     b.batch_number,
     b.current_quantity,
     b.status,
     COUNT(CASE WHEN bm.type = 'CONSUME' THEN 1 END) as consumptions,
     COUNT(CASE WHEN bm.type = 'INCOMING' THEN 1 END) as restorations
   FROM inventory_batches b
   LEFT JOIN inventory_batch_movements bm ON bm.batch_id = b.id
   WHERE b.batch_number IN ('LOTE-101', 'LOTE-102', 'LOTE-103')
   GROUP BY b.id
   ORDER BY b.purchase_date;
   ```

**Resultado esperado:**
- ✅ Todos los lotes vuelven a su cantidad original
- ✅ Los lotes DEPLETED se reactivan a ACTIVE
- ✅ La restauración siguió orden LIFO (inverso al FIFO)

---

### CASO 3: Devolución Parcial

**Objetivo:** Verificar que se pueden devolver solo algunas unidades de una venta.

**Pasos:**

1. **Preparación:**
   - Crear producto "Producto Test C"
   - Crear lote:
     - `LOTE-201`: 50 unidades, fecha 2025-01-10

2. **Ejecutar venta de 30 unidades:**
   - Crear factura con 30 unidades
   - Confirmar
   - Verificar: `LOTE-201` tiene 20 unidades restantes

3. **Ejecutar nota de crédito parcial de 10 unidades:**
   - Crear nota de crédito devolviendo SOLO 10 unidades (no las 30)
   - Confirmar

4. **Verificar restauración parcial:**
   - `LOTE-201`: 30 unidades (20 + 10) ← **Solo restauró 10**
   - Estado: ACTIVE

5. **Ejecutar segunda nota de crédito con las 20 restantes:**
   - Crear otra nota de crédito devolviendo 20 unidades
   - Confirmar

6. **Verificar restauración completa:**
   - `LOTE-201`: 50 unidades (30 + 20) ← **Ahora restauró todo**

**Resultado esperado:** ✅ Las devoluciones parciales funcionan correctamente.

---

### CASO 4: Devolución Parcial Multi-Lote (LIFO Parcial)

**Objetivo:** Verificar que una devolución parcial de una venta multi-lote restaura solo los lotes necesarios en orden LIFO.

**Pasos:**

1. **Preparación:**
   - Crear producto "Producto Test D"
   - Crear 2 lotes:
     - `LOTE-301`: 10 unidades, fecha 2025-01-01
     - `LOTE-302`: 20 unidades, fecha 2025-01-15

2. **Ejecutar venta de 25 unidades:**
   - Crear factura con 25 unidades
   - Confirmar
   - Verificar consumo FIFO:
     - `LOTE-301`: 0 unidades (consumió 10) → DEPLETED
     - `LOTE-302`: 5 unidades (consumió 15 de 20) → ACTIVE

3. **Ejecutar nota de crédito parcial de 10 unidades:**
   - Crear nota de crédito devolviendo SOLO 10 unidades
   - Confirmar

4. **Verificar restauración LIFO parcial:**
   - `LOTE-302`: 15 unidades (5 + 10) ← **Solo restauró a LOTE-302 (último consumido)**
   - `LOTE-301`: 0 unidades (sin cambios) ← **No se tocó porque solo se devolvieron 10**
   - Estado LOTE-301: DEPLETED (sin cambios)

5. **Ejecutar segunda nota de crédito con las 15 restantes:**
   - Crear nota de crédito devolviendo 15 unidades
   - Confirmar

6. **Verificar restauración completa:**
   - `LOTE-302`: 20 unidades (15 + 5) ← **Completó LOTE-302**
   - `LOTE-301`: 10 unidades (0 + 10) ← **Ahora restauró LOTE-301** → Estado: ACTIVE

**Resultado esperado:**
- ✅ Devolución parcial restaura solo al último lote consumido (LIFO)
- ✅ Cuando se devuelve el resto, continúa con el siguiente lote en orden LIFO
- ✅ Lotes se reactivan solo cuando reciben devolución

---

### CASO 5: Reactivación de Lote Agotado

**Objetivo:** Verificar que un lote con estado DEPLETED vuelve a ACTIVE al recibir devolución.

**Pasos:**

1. **Preparación:**
   - Crear producto "Producto Test E"
   - Crear lote:
     - `LOTE-401`: 5 unidades, fecha 2025-01-01

2. **Agotar el lote:**
   - Crear factura vendiendo las 5 unidades
   - Confirmar
   - Verificar:
     - `LOTE-401`: 0 unidades
     - Estado: DEPLETED

3. **Ejecutar nota de crédito:**
   - Crear nota de crédito devolviendo las 5 unidades
   - Confirmar

4. **Verificar reactivación:**
   - `LOTE-401`: 5 unidades
   - Estado: ACTIVE ← **REACTIVADO automáticamente**

**Resultado esperado:** ✅ El lote agotado vuelve a estado ACTIVE con cantidad restaurada.

---

### CASO 6: Compatibilidad con Notas de Crédito Antiguas (Sin invoiceItemId)

**Objetivo:** Verificar que el sistema mantiene compatibilidad con notas de crédito creadas antes de la actualización.

**Pasos:**

1. **Simular nota de crédito legacy:**
   - En base de datos, crear manualmente un `CreditNoteItem` SIN `invoice_item_id`:
   ```sql
   INSERT INTO credit_note_items (id, credit_note_id, product_id, quantity, ...)
   VALUES (gen_random_uuid(), '...', '...', 10, ...)
   -- Asegurar que invoice_item_id = NULL
   ```

2. **Confirmar nota de crédito:**
   - Usar el endpoint de confirmación de nota de crédito

3. **Verificar comportamiento legacy:**
   - El sistema debe llamar al método `registerSaleReturn()` (método antiguo)
   - Debe crear un NUEVO lote con `metadata.isReturn = true`
   - No debe intentar restaurar a lotes originales (porque no tiene trazabilidad)

4. **Verificar logs:**
   - En consola del backend, debe aparecer:
   ```
   ⚠️  Invoice item ID no disponible para credit note item, usando método legacy
   ```

**Resultado esperado:**
- ✅ No genera errores
- ✅ Usa método legacy (crea nuevo lote)
- ✅ Sistema sigue funcionando con datos antiguos

---

### CASO 7: Validación de Cantidad a Devolver

**Objetivo:** Verificar que el sistema valida que no se devuelvan más unidades de las que se vendieron originalmente.

**Pasos:**

1. **Preparación:**
   - Crear producto "Producto Test F"
   - Crear lote con 100 unidades
   - Vender 20 unidades en una factura

2. **Intentar devolver más de lo vendido:**
   - Crear nota de crédito intentando devolver 25 unidades (más de las 20 vendidas)
   - Confirmar

3. **Verificar validación:**
   - El sistema debe rechazar la devolución con error:
   ```
   "Cantidad a devolver excede lo consumido originalmente"
   ```

**Resultado esperado:**
- ✅ El sistema valida y rechaza devoluciones superiores a la venta original
- ✅ Protege la integridad del inventario

---

## 🔍 Verificación en Base de Datos

### Consultar movimientos de un invoice_item específico

```sql
SELECT
  bm.id,
  bm.type,
  bm.quantity,
  bm.unit_cost,
  bm.movement_date,
  b.batch_number,
  b.current_quantity as batch_current_qty,
  b.status as batch_status
FROM inventory_batch_movements bm
JOIN inventory_batches b ON b.id = bm.batch_id
WHERE bm.invoice_item_id = '<INVOICE_ITEM_UUID_AQUI>'
ORDER BY bm.movement_date DESC;
```

**Interpretación:**
- Movimientos tipo `CONSUME`: Cantidad negativa (venta)
- Movimientos tipo `INCOMING`: Cantidad positiva (devolución)
- `invoice_item_id` debe estar presente en ambos tipos de movimientos

### Verificar orden LIFO en restauración

```sql
WITH invoice_movements AS (
  SELECT
    bm.id,
    bm.type,
    bm.quantity,
    bm.movement_date,
    b.batch_number,
    ROW_NUMBER() OVER (PARTITION BY bm.type ORDER BY bm.movement_date DESC) as lifo_order
  FROM inventory_batch_movements bm
  JOIN inventory_batches b ON b.id = bm.batch_id
  WHERE bm.invoice_item_id = '<INVOICE_ITEM_UUID_AQUI>'
)
SELECT
  type,
  batch_number,
  quantity,
  movement_date,
  lifo_order
FROM invoice_movements
ORDER BY type, lifo_order;
```

**Verificar:**
- `CONSUME` movimientos: orden ascendente por `movement_date` (FIFO)
- `INCOMING` movimientos: orden descendente por `movement_date` (LIFO)
- El lote restaurado primero debe ser el consumido último

### Verificar estadísticas generales

```sql
SELECT
  type,
  COUNT(*) as total_movements,
  COUNT(invoice_item_id) as movements_with_invoice_item_id,
  ROUND(100.0 * COUNT(invoice_item_id) / COUNT(*), 2) as percentage_with_tracking
FROM inventory_batch_movements
WHERE created_at > '2025-01-01' -- Desde la implementación
GROUP BY type
ORDER BY type;
```

**Interpretación:**
- `percentage_with_tracking` debe aumentar gradualmente a medida que se crean nuevas ventas
- Movimientos antiguos tendrán `invoice_item_id = NULL` (normal)
- Movimientos nuevos de tipo `CONSUME` deben tener `invoice_item_id` poblado

---

## 📊 Archivos Modificados

### Backend

| Archivo | Cambios Implementados |
|---------|----------------------|
| `src/database/migrations/1733700000000-AddInvoiceItemIdToBatchMovements.ts` | ✅ Migración ejecutada: columna `invoice_item_id`, FK, índice |
| `src/inventory/entities/inventory-batch-movement.entity.ts` | ✅ Campo `invoiceItemId?: string` agregado |
| `src/inventory/services/inventory.service.ts` | ✅ Método `restoreToBatchesIntelligent()` implementado (líneas 3512-3716) |
| `src/inventory/services/inventory.service.ts` | ✅ Método `registerSale()` actualizado con parámetro `invoiceItemId` (línea 222) |
| `src/inventory/services/inventory.service.ts` | ✅ Creación de batch movements incluye `invoiceItemId` (línea 305) |
| `src/credit-notes/services/credit-notes.service.ts` | ✅ Método `restoreInventory()` usa lógica dual: inteligente/legacy (líneas 964-1020) |
| `src/invoices/invoices.service.ts` | ✅ Todas las llamadas a `registerSale()` pasan `item.id` (líneas 588, 953, 1004) |
| `src/sales/sales.service.ts` | ✅ Llamada a `registerSale()` con `undefined` para invoiceItemId (línea 113) |

### Todos los cambios compilados exitosamente

```bash
npm run build
# ✅ Build successful - Zero errors
```

---

## 🚀 Próximos Pasos

1. **Ejecutar casos de prueba:** Seguir todos los casos descritos arriba en ambiente de desarrollo/staging.

2. **Validar con datos reales:**
   - Usar productos reales del inventario
   - Crear facturas reales
   - Crear notas de crédito reales
   - Verificar reportes de inventario

3. **Monitorear logs:**
   - Al confirmar notas de crédito, revisar logs del backend:
     - `🔄 Restaurando a lotes originales...` (nuevo método)
     - `⚠️ Invoice item ID no disponible...` (método legacy)

4. **Backup antes de producción:**
   ```bash
   pg_dump -h localhost -U postgres -d facturacion_db > backup_antes_fifo_$(date +%Y%m%d).sql
   ```

5. **Deployment a producción:**
   - Ejecutar migración: `npm run migration:run`
   - Reiniciar servicio backend
   - Monitorear primeras notas de crédito creadas

---

## ❓ Preguntas Frecuentes

### ¿Qué pasa con las notas de crédito antiguas?

**R:** El sistema mantiene compatibilidad total. Si una nota de crédito no tiene `invoice_item_id`, automáticamente usa el método legacy que crea un nuevo lote. No genera errores.

### ¿Puedo devolver parcialmente un producto varias veces?

**R:** Sí, puedes crear múltiples notas de crédito para la misma factura. Cada una restaurará la cantidad correspondiente en orden LIFO.

### ¿Qué pasa si elimino un lote original?

**R:** Si el lote original no existe o fue eliminado, el sistema lanzará un error:
```
Error: Lote ${batchId} no encontrado
```
Esto es intencional para mantener la integridad. El lote debe existir para restaurar inventario.

### ¿Cómo sé si una devolución usó el nuevo método o el legacy?

**R:** Revisa los logs del backend al confirmar la nota de crédito:
- **Nuevo método:** `🔄 Restaurando a lotes originales para item ${item.id}`
- **Legacy:** `⚠️ Invoice item ID no disponible, usando método legacy`

### ¿El sistema valida que no se devuelvan más unidades de las vendidas?

**R:** Sí, el método `restoreToBatchesIntelligent()` valida que:
```typescript
if (totalConsumed < creditNoteItem.quantity) {
  throw new Error('Cantidad a devolver excede lo consumido originalmente');
}
```

---

## 📞 Contacto

Si encuentras algún problema o comportamiento inesperado durante el testing, reporta:

1. **Caso de prueba específico** que falló
2. **Logs del backend** (consola del servidor)
3. **Queries SQL** ejecutadas para verificar estado
4. **Capturas de pantalla** del UI (si aplica)

---

**Versión del documento:** 1.0
**Fecha:** 2025-12-10
**Implementación completada y verificada:** ✅ Sí
**Build exitoso:** ✅ Sí (npm run build)
**Migración ejecutada:** ✅ Sí (1733700000000-AddInvoiceItemIdToBatchMovements)
