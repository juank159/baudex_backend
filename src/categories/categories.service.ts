// import {
//   Injectable,
//   NotFoundException,
//   ConflictException,
//   BadRequestException,
// } from '@nestjs/common';
// import { CategoryRepository } from './repositories/category.repository';
// import { CreateCategoryDto } from './dto/create-category.dto';
// import { UpdateCategoryDto } from './dto/update-category.dto';
// import { CategoryQueryDto } from './dto/category-query.dto';
// import { Category, CategoryStatus } from './entities/category.entity';
// import { PaginatedResponseDto } from './../common/dto/pagination-response.dto';

// @Injectable()
// export class CategoryService {
//   constructor(private readonly categoryRepository: CategoryRepository) {}

//   async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
//     // Verificar si el slug ya existe
//     const existingCategory = await this.categoryRepository.findBySlug(
//       createCategoryDto.slug,
//     );
//     if (existingCategory) {
//       throw new ConflictException('El slug ya está en uso');
//     }

//     // Verificar si la categoría padre existe
//     if (createCategoryDto.parentId) {
//       const parentCategory = await this.categoryRepository.findOne({
//         where: { id: createCategoryDto.parentId },
//       });
//       if (!parentCategory) {
//         throw new NotFoundException('Categoría padre no encontrada');
//       }
//     }

//     // Obtener el siguiente número de orden
//     if (!createCategoryDto.sortOrder) {
//       const maxOrder = await this.categoryRepository.getMaxSortOrder(
//         createCategoryDto.parentId,
//       );
//       createCategoryDto.sortOrder = maxOrder + 1;
//     }

//     const category = this.categoryRepository.create(createCategoryDto);
//     return this.categoryRepository.save(category);
//   }

//   async findAll(
//     query: CategoryQueryDto,
//   ): Promise<PaginatedResponseDto<Category>> {
//     return this.categoryRepository.findAllPaginated(query);
//   }

//   async findOne(id: string): Promise<Category> {
//     const category = await this.categoryRepository.findOne({
//       where: { id },
//       relations: ['parent', 'children', 'products'],
//     });

//     if (!category) {
//       throw new NotFoundException('Categoría no encontrada');
//     }

//     return category;
//   }

//   async findBySlug(slug: string): Promise<Category> {
//     const category = await this.categoryRepository.findBySlug(slug);
//     if (!category) {
//       throw new NotFoundException('Categoría no encontrada');
//     }
//     return category;
//   }

//   async findTree(): Promise<Category[]> {
//     return this.categoryRepository.findTree();
//   }

//   async update(
//     id: string,
//     updateCategoryDto: UpdateCategoryDto,
//   ): Promise<Category> {
//     const category = await this.findOne(id);

//     // Verificar slug único si se está actualizando
//     if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
//       const existingCategory = await this.categoryRepository.findBySlug(
//         updateCategoryDto.slug,
//       );
//       if (existingCategory) {
//         throw new ConflictException('El slug ya está en uso');
//       }
//     }

//     // Verificar que no se asigne como padre a sí misma o a sus hijos
//     if (updateCategoryDto.parentId) {
//       if (updateCategoryDto.parentId === id) {
//         throw new BadRequestException(
//           'Una categoría no puede ser padre de sí misma',
//         );
//       }

//       // Verificar que no sea un hijo tratando de ser padre
//       const isDescendant = await this.isDescendant(
//         id,
//         updateCategoryDto.parentId,
//       );
//       if (isDescendant) {
//         throw new BadRequestException(
//           'No se puede asignar un descendiente como padre',
//         );
//       }
//     }

//     Object.assign(category, updateCategoryDto);
//     return this.categoryRepository.save(category);
//   }

//   async updateStatus(id: string, status: CategoryStatus): Promise<Category> {
//     const category = await this.findOne(id);
//     category.status = status;
//     return this.categoryRepository.save(category);
//   }

//   async reorderCategories(
//     categoryOrders: { id: string; sortOrder: number }[],
//   ): Promise<void> {
//     const categories = await this.categoryRepository.findByIds(
//       categoryOrders.map((item) => item.id),
//     );

//     for (const orderItem of categoryOrders) {
//       const category = categories.find((cat) => cat.id === orderItem.id);
//       if (category) {
//         category.sortOrder = orderItem.sortOrder;
//       }
//     }

//     await this.categoryRepository.save(categories);
//   }

//   async softDelete(id: string): Promise<void> {
//     const category = await this.findOne(id);

//     // Verificar si tiene productos asociados
//     if (category.products && category.products.length > 0) {
//       throw new BadRequestException(
//         'No se puede eliminar una categoría con productos asociados',
//       );
//     }

//     // Verificar si tiene subcategorías
//     if (category.children && category.children.length > 0) {
//       throw new BadRequestException(
//         'No se puede eliminar una categoría con subcategorías',
//       );
//     }

//     await this.categoryRepository.softRemove(category);
//   }

//   async restore(id: string): Promise<Category> {
//     const category = await this.categoryRepository.findOne({
//       where: { id },
//       withDeleted: true,
//     });

//     if (!category) {
//       throw new NotFoundException('Categoría no encontrada');
//     }

//     await this.categoryRepository.restore(id);
//     return this.findOne(id);
//   }

//   async getStats(): Promise<any> {
//     const total = await this.categoryRepository.count();
//     const active = await this.categoryRepository.count({
//       where: { status: CategoryStatus.ACTIVE },
//     });
//     const parents = await this.categoryRepository.count({
//       where: { parentId: null },
//     });

//     return {
//       total,
//       active,
//       parents,
//       children: total - parents,
//     };
//   }

//   private async isDescendant(
//     ancestorId: string,
//     descendantId: string,
//   ): Promise<boolean> {
//     const descendant = await this.categoryRepository.findOne({
//       where: { id: descendantId },
//       relations: ['parent'],
//     });

//     if (!descendant || !descendant.parent) {
//       return false;
//     }

//     if (descendant.parent.id === ancestorId) {
//       return true;
//     }

//     return this.isDescendant(ancestorId, descendant.parent.id);
//   }
// }

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CategoryRepository } from './repositories/category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { Category, CategoryStatus } from './entities/category.entity';
import { PaginatedResponseDto } from './../common/dto/pagination-response.dto';
import { SlugService } from '../common/services/slug.service';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly slugService: SlugService,
  ) {}

  // async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
  //   this.logger.log(`Creating category with name: ${createCategoryDto.name}`);

  //   // Verificar si el slug ya existe
  //   const existingCategory = await this.categoryRepository.findBySlug(
  //     createCategoryDto.slug,
  //   );
  //   if (existingCategory) {
  //     throw new ConflictException('El slug ya está en uso');
  //   }

  //   // Verificar si la categoría padre existe
  //   if (createCategoryDto.parentId) {
  //     const parentCategory = await this.categoryRepository.findOne({
  //       where: { id: createCategoryDto.parentId },
  //     });
  //     if (!parentCategory) {
  //       throw new NotFoundException('Categoría padre no encontrada');
  //     }

  //     // Validar profundidad máxima (ejemplo: máximo 3 niveles)
  //     const parentLevel = await this.getCategoryLevel(
  //       createCategoryDto.parentId,
  //     );
  //     if (parentLevel >= 2) {
  //       throw new BadRequestException(
  //         'No se puede crear una categoría con más de 3 niveles de profundidad',
  //       );
  //     }
  //   }

  //   // Obtener el siguiente número de orden
  //   if (!createCategoryDto.sortOrder) {
  //     const maxOrder = await this.categoryRepository.getMaxSortOrder(
  //       createCategoryDto.parentId,
  //     );
  //     createCategoryDto.sortOrder = maxOrder + 1;
  //   }

  //   const category = this.categoryRepository.create(createCategoryDto);
  //   const savedCategory = await this.categoryRepository.save(category);

  //   this.logger.log(
  //     `Category created successfully with ID: ${savedCategory.id}`,
  //   );
  //   return savedCategory;
  // }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    this.logger.log(`Creating category with name: ${createCategoryDto.name}`);

    // Verificar si hay una categoría eliminada con el mismo slug
    const deletedCategory = await this.categoryRepository
      .createQueryBuilder('category')
      .where('category.slug = :slug', { slug: createCategoryDto.slug })
      .withDeleted()
      .andWhere('category.deletedAt IS NOT NULL')
      .getOne();

    if (deletedCategory) {
      // Opción A: Restaurar la categoría eliminada
      this.logger.log(
        `Found deleted category with slug: ${createCategoryDto.slug}. Restoring...`,
      );

      // Actualizar la categoría eliminada con los nuevos datos
      Object.assign(deletedCategory, createCategoryDto);
      deletedCategory.deletedAt = null; // Restaurar

      const restoredCategory =
        await this.categoryRepository.save(deletedCategory);
      this.logger.log(
        `Category restored successfully with ID: ${restoredCategory.id}`,
      );
      return restoredCategory;
    }

    // Verificar si el slug ya existe en categorías activas
    const existingActiveCategory =
      await this.categoryRepository.findBySlugExcludingDeleted(
        createCategoryDto.slug,
      );

    if (existingActiveCategory) {
      throw new ConflictException(
        'El slug ya está en uso por otra categoría activa',
      );
    }

    // Verificar si la categoría padre existe
    if (createCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });
      if (!parentCategory) {
        throw new NotFoundException('Categoría padre no encontrada');
      }

      // Validar profundidad máxima (ejemplo: máximo 3 niveles)
      const parentLevel = await this.getCategoryLevel(
        createCategoryDto.parentId,
      );
      if (parentLevel >= 2) {
        throw new BadRequestException(
          'No se puede crear una categoría con más de 3 niveles de profundidad',
        );
      }
    }

    // Obtener el siguiente número de orden
    if (!createCategoryDto.sortOrder) {
      const maxOrder = await this.categoryRepository.getMaxSortOrder(
        createCategoryDto.parentId,
      );
      createCategoryDto.sortOrder = maxOrder + 1;
    }

    const category = this.categoryRepository.create(createCategoryDto);
    const savedCategory = await this.categoryRepository.save(category);

    this.logger.log(
      `Category created successfully with ID: ${savedCategory.id}`,
    );
    return savedCategory;
  }

  async findAll(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponseDto<Category>> {
    return this.categoryRepository.findAllPaginated(query);
  }

  async findAllWithDeleted(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponseDto<Category>> {
    return this.categoryRepository.findAllPaginatedWithDeleted(query);
  }

  async findDeleted(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponseDto<Category>> {
    return this.categoryRepository.findDeletedPaginated(query);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'products'],
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findBySlug(slug);
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return category;
  }

  async findTree(): Promise<Category[]> {
    return this.categoryRepository.findTree();
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    // Verificar slug único si se está actualizando
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingCategory = await this.categoryRepository.findBySlug(
        updateCategoryDto.slug,
      );
      if (existingCategory) {
        throw new ConflictException('El slug ya está en uso');
      }
    }

    // Verificar que no se asigne como padre a sí misma o a sus hijos
    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException(
          'Una categoría no puede ser padre de sí misma',
        );
      }

      // Verificar que no sea un hijo tratando de ser padre
      const isDescendant = await this.isDescendant(
        id,
        updateCategoryDto.parentId,
      );
      if (isDescendant) {
        throw new BadRequestException(
          'No se puede asignar un descendiente como padre',
        );
      }

      // Validar profundidad máxima
      const parentLevel = await this.getCategoryLevel(
        updateCategoryDto.parentId,
      );
      if (parentLevel >= 2) {
        throw new BadRequestException(
          'No se puede mover la categoría: excedería el límite de profundidad',
        );
      }
    }

    Object.assign(category, updateCategoryDto);
    const updatedCategory = await this.categoryRepository.save(category);

    this.logger.log(`Category updated successfully: ${id}`);
    return updatedCategory;
  }

  async updateStatus(id: string, status: CategoryStatus): Promise<Category> {
    const category = await this.findOne(id);

    // Si se está desactivando, verificar que no tenga hijos activos
    if (status === CategoryStatus.INACTIVE && category.children?.length > 0) {
      const activeChildren = category.children.filter(
        (child) => child.status === CategoryStatus.ACTIVE,
      );
      if (activeChildren.length > 0) {
        throw new BadRequestException(
          'No se puede desactivar una categoría con subcategorías activas',
        );
      }
    }

    category.status = status;
    const updatedCategory = await this.categoryRepository.save(category);

    this.logger.log(`Category status updated: ${id} -> ${status}`);
    return updatedCategory;
  }

  async reorderCategories(
    categoryOrders: { id: string; sortOrder: number }[],
  ): Promise<void> {
    const categories = await this.categoryRepository.findByIds(
      categoryOrders.map((item) => item.id),
    );

    for (const orderItem of categoryOrders) {
      const category = categories.find((cat) => cat.id === orderItem.id);
      if (category) {
        category.sortOrder = orderItem.sortOrder;
      }
    }

    await this.categoryRepository.save(categories);
    this.logger.log(`Reordered ${categories.length} categories`);
  }

  async softDelete(id: string): Promise<void> {
    const category = await this.findOne(id);

    // Verificar si tiene productos asociados
    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría con productos asociados',
      );
    }

    // Verificar si tiene subcategorías
    if (category.children && category.children.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría con subcategorías',
      );
    }

    await this.categoryRepository.softRemove(category);
    this.logger.log(`Category soft deleted: ${id}`);
  }

  async forceDelete(id: string): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      withDeleted: true,
      relations: ['children', 'products'],
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Verificar si tiene productos asociados
    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar permanentemente una categoría con productos asociados',
      );
    }

    // Verificar si tiene subcategorías
    if (category.children && category.children.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar permanentemente una categoría con subcategorías',
      );
    }

    await this.categoryRepository.remove(category);
    this.logger.log(`Category permanently deleted: ${id}`);
  }

  async restore(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (!category.deletedAt) {
      throw new BadRequestException('La categoría no está eliminada');
    }

    await this.categoryRepository.restore(id);
    const restoredCategory = await this.findOne(id);

    this.logger.log(`Category restored: ${id}`);
    return restoredCategory;
  }

  async getStats(): Promise<any> {
    // 🔥 SÚPER OPTIMIZADO: Una sola consulta
    const result = await this.categoryRepository
      .createQueryBuilder('category')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN category.status = :activeStatus THEN 1 END) as active',
        'COUNT(CASE WHEN category.parentId IS NULL THEN 1 END) as parents',
        'COUNT(CASE WHEN category.parentId IS NOT NULL THEN 1 END) as children',
      ])
      .where('category.deletedAt IS NULL')
      .setParameter('activeStatus', CategoryStatus.ACTIVE)
      .getRawOne();

    const deletedCount = await this.categoryRepository
      .createQueryBuilder('category')
      .where('category.deletedAt IS NOT NULL')
      .getCount();

    const total = parseInt(result.total);
    const active = parseInt(result.active);
    const parents = parseInt(result.parents);
    const children = parseInt(result.children);

    return {
      total,
      active,
      inactive: total - active,
      parents,
      children,
      deleted: deletedCount,
    };
  }

  async getAllSlugs(): Promise<string[]> {
    return this.categoryRepository.getAllSlugs();
  }

  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.slugService.generateSlug(name);
    const existingSlugs = await this.getAllSlugs();
    return this.slugService.generateUniqueSlug(baseSlug, existingSlugs);
  }

  async search(searchTerm: string, limit: number = 10): Promise<Category[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException(
        'El término de búsqueda debe tener al menos 2 caracteres',
      );
    }

    return this.categoryRepository.search(searchTerm, limit);
  }

  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const category = await this.categoryRepository.findBySlug(slug);
    if (!category) return true;
    if (excludeId && category.id === excludeId) return true;
    return false;
  }

  // Método para obtener el nivel de profundidad de una categoría
  private async getCategoryLevel(categoryId: string): Promise<number> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: ['parent'],
    });

    if (!category) return 0;

    let level = 0;
    let current = category;

    while (current?.parent) {
      level++;
      current = await this.categoryRepository.findOne({
        where: { id: current.parent.id },
        relations: ['parent'],
      });
    }

    return level;
  }

  private async isDescendant(
    ancestorId: string,
    descendantId: string,
  ): Promise<boolean> {
    const descendant = await this.categoryRepository.findOne({
      where: { id: descendantId },
      relations: ['parent'],
    });

    if (!descendant || !descendant.parent) {
      return false;
    }

    if (descendant.parent.id === ancestorId) {
      return true;
    }

    return this.isDescendant(ancestorId, descendant.parent.id);
  }
}
