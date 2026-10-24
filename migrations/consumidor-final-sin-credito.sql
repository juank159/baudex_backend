-- Consumidor Final: nunca puede tener cupo de crédito.
-- Baudity, Cellpro y Granada lo tenían con cupo de $3.000.000 (respaldo 19-oct).
-- Solo cambia el cupo (no toca deudas, facturas ni pagos). Idempotente.
UPDATE customers
SET "creditLimit" = 0,
    updated_at = NOW()
WHERE "documentNumber" = '222222222222'
  AND "creditLimit" <> 0;
