// Script temporal para ejecutar la migración de stock
const { DataSource } = require('typeorm');

async function runMigration() {
  console.log('🚀 Iniciando migración de stock...');
  
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'baudex',
    password: 'baudex123',
    database: 'baudex',
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado a la base de datos');

    // Buscar productos con stock pero sin lotes
    const query = `
      SELECT p.id, p.name, p.sku, p.stock, p.organization_id
      FROM products p
      WHERE p.stock > 0 
        AND p.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM inventory_batches ib 
          WHERE ib.product_id = p.id AND ib.status = 'active'
        )
    `;

    const products = await dataSource.query(query);
    console.log(`📦 Encontrados ${products.length} productos para migrar`);

    for (const product of products) {
      console.log(`🔄 Migrando: ${product.name} (Stock: ${product.stock})`);
      
      // Generar número de lote
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-6);
      const batchNumber = `BATCH-${year}${month}-${timestamp}`;
      
      // Generar número de movimiento
      const movementNumber = `MOV-${year}${month}-${timestamp}`;
      
      const unitCost = 1000; // Valor por defecto
      const totalCost = product.stock * unitCost;
      
      await dataSource.query(`BEGIN`);
      
      try {
        // Crear lote
        const batchResult = await dataSource.query(`
          INSERT INTO inventory_batches 
          (id, batch_number, product_id, organization_id, purchase_date, 
           original_quantity, current_quantity, reserved_quantity, 
           unit_cost, total_cost, remaining_value, status, metadata, 
           created_at, updated_at)
          VALUES 
          (gen_random_uuid(), $1, $2, $3, NOW(), 
           $4, $4, 0, 
           $5, $6, $6, 'active', 
           '{"source": "initial_stock", "createdWithProduct": false, "note": "Migración de stock inicial"}',
           NOW(), NOW())
          RETURNING id
        `, [batchNumber, product.id, product.organization_id, product.stock, unitCost, totalCost]);
        
        // Crear movimiento
        await dataSource.query(`
          INSERT INTO inventory_movements 
          (id, movement_number, type, status, movement_date, 
           quantity, unit_cost, total_cost, stock_after, stock_value_after, 
           reference_type, notes, organization_id, product_id, created_by_id, 
           created_at, updated_at)
          VALUES 
          (gen_random_uuid(), $1, 'initial_stock', 'confirmed', NOW(), 
           $2, $3, $4, $2, $4, 
           'initial_stock', 'Migración de stock inicial', $5, $6, $7,
           NOW(), NOW())
        `, [movementNumber, product.stock, unitCost, totalCost, product.organization_id, product.id, '96e67dec-c329-430f-91c6-7cee0804656a']);
        
        await dataSource.query(`COMMIT`);
        console.log(`  ✅ ${product.name} migrado exitosamente`);
        
      } catch (error) {
        await dataSource.query(`ROLLBACK`);
        console.error(`  ❌ Error migrando ${product.name}:`, error.message);
      }
    }
    
    console.log('🎉 Migración completada');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await dataSource.destroy();
  }
}

runMigration();