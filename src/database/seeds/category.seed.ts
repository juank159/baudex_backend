import {
  Category,
  CategoryStatus,
} from 'src/categories/entities/category.entity';
import { DataSource } from 'typeorm';

export class CategorySeeder {
  static async run(dataSource: DataSource): Promise<void> {
    const categoryRepository = dataSource.getRepository(Category);

    // Verificar si ya existen categorías
    const existingCategories = await categoryRepository.count();
    if (existingCategories > 0) {
      console.log('📁 Categorías ya existen, saltando seed');
      return;
    }

    // Crear categorías padre
    const parentCategories = [
      {
        name: 'Electrónicos',
        slug: 'electronicos',
        description: 'Productos electrónicos y tecnología',
        status: CategoryStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        name: 'Ropa y Accesorios',
        slug: 'ropa-accesorios',
        description: 'Prendas de vestir y accesorios',
        status: CategoryStatus.ACTIVE,
        sortOrder: 2,
      },
      {
        name: 'Hogar y Jardín',
        slug: 'hogar-jardin',
        description: 'Artículos para el hogar y jardín',
        status: CategoryStatus.ACTIVE,
        sortOrder: 3,
      },
    ];

    const createdParents = await categoryRepository.save(parentCategories);

    // Crear subcategorías
    const subCategories = [
      {
        name: 'Smartphones',
        slug: 'smartphones',
        description: 'Teléfonos inteligentes',
        parentId: createdParents[0].id,
        status: CategoryStatus.ACTIVE,
        sortOrder: 1,
      },
      {
        name: 'Laptops',
        slug: 'laptops',
        description: 'Computadoras portátiles',
        parentId: createdParents[0].id,
        status: CategoryStatus.ACTIVE,
        sortOrder: 2,
      },
      {
        name: 'Camisetas',
        slug: 'camisetas',
        description: 'Camisetas para hombre y mujer',
        parentId: createdParents[1].id,
        status: CategoryStatus.ACTIVE,
        sortOrder: 1,
      },
    ];

    await categoryRepository.save(subCategories);

    console.log('📁 Categorías seed completado');
  }
}
