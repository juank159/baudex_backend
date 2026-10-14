-- =============================================================================
-- Corrección de abonos a crédito guardados con la hora corrida
-- =============================================================================
--
-- QUÉ PASÓ
--   Versiones anteriores de la app mandaban la hora del abono sin zona horaria
--   (p. ej. "2026-10-13T08:22:11") y el servidor la tomaba como hora universal.
--   En Caracas (UTC-4) el abono quedaba guardado 4 horas ANTES de la hora real
--   (08:22 → 04:22), y la caja del turno lo dejaba por fuera por quedar
--   "antes de la apertura".
--
-- QUÉ CORRIGE
--   Solo abonos del módulo de créditos (`credit_payments`) y su copia en el
--   historial de la factura (`payments` con referencia SYNC-CRD-<id>), del
--   negocio indicado, que cumplen la huella del error:
--     · el servidor los recibió entre 3,95 h y 52 h después de la hora
--       guardada (el desfase del negocio + el tiempo que tardó en subir), y
--     · NO son de saldo a favor.
--   La hora se reinterpreta: el reloj guardado se toma como hora del negocio.
--     04:22 UTC (guardado) → 08:22 Caracas = 12:22 UTC (real).
--
--   Análisis previo en Mercaexpress (13-oct-2026): 251 abonos, todos en
--   efectivo. Con la hora corregida, los 251 caen en horario de atención
--   (7:00-22:00); con la hora guardada, solo 200. Los pagos de FACTURAS no
--   tienen este error y no se tocan.
--
-- QUÉ NO CAMBIA
--   · Montos, saldos, créditos, facturas: nada de eso se modifica.
--   · Cierres de caja YA CERRADOS: conservan su cifra guardada. El turno
--     ABIERTO se recalcula solo al consultarlo.
--
-- CÓMO USARLO
--   1. Ajustar :org_id abajo (por defecto Mercaexpress).
--   2. Correr la PARTE 1 (solo lectura) y revisar.
--   3. Correr la PARTE 2 completa. Guarda una copia de respaldo de cada hora
--      cambiada en la tabla data_fix_20261013_payment_times.
--   4. Si algo no cuadra, la PARTE 3 deja todo como estaba.
--   Se puede correr más de una vez: la PARTE 2 nunca corrige dos veces el
--   mismo abono (consulta el respaldo). Si ya se corrió, la PARTE 1 puede
--   volver a listar algunos abonos ya corregidos; eso es normal.
--
-- Probado en una base de pruebas (corrección, segunda corrida y deshacer).
-- La PARTE 1 se corrió en producción en modo solo lectura el 13-oct-2026:
-- 251 abonos (3.024.400) y sus 251 copias en facturas. La PARTE 2 NO se ha
-- corrido en producción.
-- =============================================================================

\set org_id '8c5a2625-bdcf-4250-bc22-8c57f378273b'

-- -----------------------------------------------------------------------------
-- PARTE 1 — Revisión (solo lectura)
-- -----------------------------------------------------------------------------
WITH org AS (
  SELECT id, timezone FROM organizations WHERE id = :'org_id'
),
afectados AS (
  SELECT cp.id, cp.amount, cp.payment_method, cp.payment_date AS hora_guardada,
         (cp.payment_date AT TIME ZONE 'UTC') AT TIME ZONE org.timezone AS hora_corregida,
         cp.created_at AS recibido_en_servidor
  FROM credit_payments cp
  JOIN org ON org.id = cp.organization_id
  WHERE cp.deleted_at IS NULL
    AND cp.payment_method NOT IN ('saldo_favor', 'client_balance')
    AND extract(epoch FROM cp.created_at - cp.payment_date) / 3600 BETWEEN 3.95 AND 52
    AND ((cp.payment_date AT TIME ZONE 'UTC') AT TIME ZONE org.timezone) <= cp.created_at + interval '2 minutes'
)
SELECT count(*) AS abonos, sum(amount) AS total, min(recibido_en_servidor)::date AS desde,
       max(recibido_en_servidor)::date AS hasta,
       (SELECT count(*) FROM payments p
         WHERE p.organization_id = :'org_id' AND p.deleted_at IS NULL
           AND p.reference IN (SELECT 'SYNC-CRD-' || id::text FROM afectados)) AS copias_en_facturas
FROM afectados;

-- -----------------------------------------------------------------------------
-- PARTE 2 — Corrección (todo o nada)
-- -----------------------------------------------------------------------------
BEGIN;

CREATE TABLE IF NOT EXISTS data_fix_20261013_payment_times (
  table_name    text        NOT NULL,
  row_id        uuid        NOT NULL,
  old_value     timestamptz NOT NULL,
  new_value     timestamptz NOT NULL,
  fixed_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, row_id)
);

-- Abonos a crédito que cumplen la huella (y que no se hayan corregido antes)
CREATE TEMP TABLE fix_targets ON COMMIT DROP AS
SELECT cp.id,
       cp.payment_date AS old_value,
       (cp.payment_date AT TIME ZONE 'UTC') AT TIME ZONE o.timezone AS new_value
FROM credit_payments cp
JOIN organizations o ON o.id = cp.organization_id
WHERE cp.organization_id = :'org_id'
  AND cp.deleted_at IS NULL
  AND cp.payment_method NOT IN ('saldo_favor', 'client_balance')
  AND extract(epoch FROM cp.created_at - cp.payment_date) / 3600 BETWEEN 3.95 AND 52
  AND ((cp.payment_date AT TIME ZONE 'UTC') AT TIME ZONE o.timezone) <= cp.created_at + interval '2 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM data_fix_20261013_payment_times f
    WHERE f.table_name = 'credit_payments' AND f.row_id = cp.id
  );

-- Respaldo antes de tocar nada
INSERT INTO data_fix_20261013_payment_times (table_name, row_id, old_value, new_value)
SELECT 'credit_payments', id, old_value, new_value FROM fix_targets;

INSERT INTO data_fix_20261013_payment_times (table_name, row_id, old_value, new_value)
SELECT 'payments', p.id, p."paymentDate", t.new_value
FROM payments p
JOIN fix_targets t ON p.reference = 'SYNC-CRD-' || t.id::text
WHERE p.organization_id = :'org_id'
  AND p.deleted_at IS NULL
  AND p."paymentDate" = t.old_value;

-- Corregir
UPDATE credit_payments cp
SET payment_date = t.new_value
FROM fix_targets t
WHERE cp.id = t.id;

UPDATE payments p
SET "paymentDate" = f.new_value
FROM data_fix_20261013_payment_times f
WHERE f.table_name = 'payments'
  AND f.row_id = p.id
  AND p."paymentDate" = f.old_value;

-- Verificación: debe mostrar los mismos conteos que la PARTE 1
SELECT table_name, count(*) AS corregidos, min(old_value) AS hora_mas_antigua
FROM data_fix_20261013_payment_times
WHERE fixed_at >= now() - interval '1 minute'
GROUP BY table_name;

COMMIT;

-- -----------------------------------------------------------------------------
-- PARTE 3 — Deshacer (solo si hace falta)
-- -----------------------------------------------------------------------------
-- BEGIN;
-- UPDATE credit_payments cp SET payment_date = f.old_value
--   FROM data_fix_20261013_payment_times f
--   WHERE f.table_name = 'credit_payments' AND f.row_id = cp.id;
-- UPDATE payments p SET "paymentDate" = f.old_value
--   FROM data_fix_20261013_payment_times f
--   WHERE f.table_name = 'payments' AND f.row_id = p.id;
-- DELETE FROM data_fix_20261013_payment_times;
-- COMMIT;
