import { DataSource } from 'typeorm';
import {
  ExpenseCategory,
  ExpenseCategoryStatus,
} from '../../expenses/entities/expense-category.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export default async function seedExpenseCategories(dataSource: DataSource) {
  const categoryRepository = dataSource.getRepository(ExpenseCategory);
  const organizationRepository = dataSource.getRepository(Organization);

  console.log('🔄 Creando categorías de gastos por defecto...');

  // Obtener todas las organizaciones
  const organizations = await organizationRepository.find();

  const defaultCategories = [
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
      description:
        'Compra de materiales de oficina, suministros y herramientas',
      color: '#96CEB4',
      monthlyBudget: 400000,
      sortOrder: 4,
    },
    {
      name: 'Capacitación',
      description:
        'Cursos, seminarios, entrenamientos y desarrollo profesional',
      color: '#FECA57',
      monthlyBudget: 600000,
      sortOrder: 5,
    },
    {
      name: 'Tecnología',
      description: 'Software, hardware, licencias y servicios tecnológicos',
      color: '#FF9FF3',
      monthlyBudget: 1000000,
      sortOrder: 6,
    },
    {
      name: 'Marketing',
      description: 'Publicidad, promociones, eventos y material promocional',
      color: '#F38BA8',
      monthlyBudget: 750000,
      sortOrder: 7,
    },
    {
      name: 'Servicios Profesionales',
      description: 'Consultorías, asesorías legales, servicios contables',
      color: '#A8DADC',
      monthlyBudget: 1200000,
      sortOrder: 8,
    },
    {
      name: 'Comunicaciones',
      description: 'Internet, telefonía, servicios de comunicación',
      color: '#457B9D',
      monthlyBudget: 200000,
      sortOrder: 9,
    },
    {
      name: 'Representación',
      description: 'Gastos en entretenimiento de clientes y representación',
      color: '#E63946',
      monthlyBudget: 400000,
      sortOrder: 10,
    },
    {
      name: 'Mantenimiento',
      description: 'Reparaciones, mantenimiento de equipos e instalaciones',
      color: '#6A994E',
      monthlyBudget: 350000,
      sortOrder: 11,
    },
    {
      name: 'Otros Gastos',
      description: 'Gastos varios que no encajan en otras categorías',
      color: '#6C757D',
      monthlyBudget: 300000,
      sortOrder: 12,
    },
  ];

  let totalCreated = 0;

  for (const organization of organizations) {
    console.log(
      `   📁 Creando categorías para organización: ${organization.name}`,
    );

    for (const categoryData of defaultCategories) {
      // Verificar si la categoría ya existe para esta organización
      const existingCategory = await categoryRepository.findOne({
        where: {
          name: categoryData.name,
          organizationId: organization.id,
        },
      });

      if (!existingCategory) {
        const category = categoryRepository.create({
          ...categoryData,
          organizationId: organization.id,
          status: ExpenseCategoryStatus.ACTIVE,
          isRequired: false,
        });

        await categoryRepository.save(category);
        totalCreated++;
        console.log(`      ✅ Categoría creada: ${categoryData.name}`);
      } else {
        console.log(`      ⏭️ Categoría ya existe: ${categoryData.name}`);
      }
    }
  }

  console.log(
    `✅ Seed de categorías de gastos completado: ${totalCreated} categorías creadas`,
  );
}
