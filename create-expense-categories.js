const { Client } = require('pg');

async function createExpenseCategories() {
  // Configuración de la base de datos
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123456',
    database: 'baudex',
  });

  try {
    await client.connect();
    console.log('🔌 Conectado a la base de datos');

    // Obtener la organización por defecto
    const orgResult = await client.query(
      "SELECT id FROM organizations WHERE slug = 'default' LIMIT 1"
    );

    if (orgResult.rows.length === 0) {
      console.log('❌ No se encontró la organización por defecto');
      return;
    }

    const organizationId = orgResult.rows[0].id;
    console.log('✅ Organización encontrada:', organizationId);

    // Verificar si ya existen categorías
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM expense_categories WHERE organization_id = $1',
      [organizationId]
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log('✅ Ya existen categorías de gastos');
      return;
    }

    // Categorías por defecto
    const categories = [
      {
        name: 'Alimentación',
        description: 'Gastos en alimentos, restaurantes y comidas de trabajo',
        color: '#FF6B6B',
        monthlyBudget: 500000,
        sortOrder: 1,
      },
      {
        name: 'Transporte',
        description: 'Gastos en combustible, taxis, Uber, transporte público',
        color: '#4ECDC4',
        monthlyBudget: 300000,
        sortOrder: 2,
      },
      {
        name: 'Hospedaje',
        description: 'Gastos en hoteles y alojamiento para viajes de trabajo',
        color: '#45B7D1',
        monthlyBudget: 800000,
        sortOrder: 3,
      },
      {
        name: 'Materiales y Suministros',
        description: 'Compra de materiales de oficina, suministros y herramientas',
        color: '#96CEB4',
        monthlyBudget: 400000,
        sortOrder: 4,
      },
      {
        name: 'Tecnología',
        description: 'Software, hardware, licencias y servicios tecnológicos',
        color: '#FF9FF3',
        monthlyBudget: 1000000,
        sortOrder: 6,
      },
    ];

    // Insertar categorías
    console.log('📝 Creando categorías...');
    
    for (const category of categories) {
      const result = await client.query(`
        INSERT INTO expense_categories (
          id, name, description, color, status, "monthlyBudget", "isRequired", 
          "sortOrder", organization_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'active', $4, false, $5, $6, NOW(), NOW()
        ) RETURNING id, name
      `, [
        category.name,
        category.description,
        category.color,
        category.monthlyBudget,
        category.sortOrder,
        organizationId
      ]);

      console.log(`✅ Categoría creada: ${result.rows[0].name} (${result.rows[0].id})`);
    }

    console.log('🎉 Categorías de gastos creadas exitosamente');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada');
  }
}

createExpenseCategories();