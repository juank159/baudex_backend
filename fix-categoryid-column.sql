-- Arreglar problema con la columna categoryId en products
-- 
-- Problema: TypeORM está tratando de agregar una columna "categoryId" nueva 
-- cuando ya existe "category_id", causando conflictos

BEGIN;

-- 1. Verificar estructura actual de la tabla
\d products;

-- 2. Si existe categoryId con valores nulos, actualizarla con los valores de category_id
UPDATE products 
SET "categoryId" = category_id 
WHERE "categoryId" IS NULL AND category_id IS NOT NULL;

-- 3. Si la columna categoryId no existe, la agregamos y la llenamos
DO $$ 
BEGIN
    -- Intentar agregar la columna categoryId si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'products' AND column_name = 'categoryId') THEN
        ALTER TABLE products ADD COLUMN "categoryId" uuid;
        -- Llenar con los valores de category_id
        UPDATE products SET "categoryId" = category_id WHERE category_id IS NOT NULL;
        -- Hacer NOT NULL si es necesario
        ALTER TABLE products ALTER COLUMN "categoryId" SET NOT NULL;
    END IF;

    -- Lo mismo para createdById
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'products' AND column_name = 'createdById') THEN
        ALTER TABLE products ADD COLUMN "createdById" uuid;
        -- Llenar con los valores de created_by_id
        UPDATE products SET "createdById" = created_by_id WHERE created_by_id IS NOT NULL;
        -- Hacer NOT NULL si es necesario
        ALTER TABLE products ALTER COLUMN "createdById" SET NOT NULL;
    END IF;
END $$;

COMMIT;