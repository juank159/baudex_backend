import { Injectable } from '@nestjs/common';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { Category, CategoryStatus } from '../entities/category.entity';
import { CategoryQueryDto } from '../dto/category-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/pagination-response.dto';

@Injectable()
export class CategoryRepository extends Repository<Category> {
  constructor(private dataSource: DataSource) {
    super(Category, dataSource.createEntityManager());
  }

  // ==================== MÉTODOS DE CONSULTA PAGINADA ====================

  async findAllPaginated(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponseDto<Category>> {
    const queryBuilder = this.createQueryBuilder('category');

    // Incluir relaciones según los parámetros
    if (query.includeChildren) {
      queryBuilder.leftJoinAndSelect('category.children', 'children');
    }

    queryBuilder.leftJoinAndSelect('category.parent', 'parent');

    // Aplicar filtros
    this.applyFilters(queryBuilder, query);

    // Aplicar búsqueda
    if (query.search) {
      queryBuilder.andWhere(
        '(category.name ILIKE :search OR category.description ILIKE :search OR category.slug ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Aplicar ordenamiento
    queryBuilder.orderBy(`category.${query.sortBy}`, query.sortOrder);
    queryBuilder.addOrderBy('category.sortOrder', 'ASC');

    // Aplicar paginación
    const offset = (query.page - 1) * query.limit;
    queryBuilder.skip(offset).take(query.limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    const meta: PaginationMetaDto = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit),
      hasNextPage: query.page < Math.ceil(totalItems / query.limit),
      hasPreviousPage: query.page > 1,
    };

    return { data, meta };
  }

  async findAllPaginatedWithDeleted(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponseDto<Category>> {
    const queryBuilder = this.createQueryBuilder('category').withDeleted(); // Incluir elementos eliminados

    // Incluir relaciones según los parámetros
    if (query.includeChildren) {
      queryBuilder.leftJoinAndSelect('category.children', 'children');
    }

    queryBuilder.leftJoinAndSelect('category.parent', 'parent');

    // Aplicar filtros
    this.applyFilters(queryBuilder, query);

    // Aplicar búsqueda
    if (query.search) {
      queryBuilder.andWhere(
        '(category.name ILIKE :search OR category.description ILIKE :search OR category.slug ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Aplicar ordenamiento
    queryBuilder.orderBy(`category.${query.sortBy}`, query.sortOrder);
    queryBuilder.addOrderBy('category.sortOrder', 'ASC');

    // Aplicar paginación
    const offset = (query.page - 1) * query.limit;
    queryBuilder.skip(offset).take(query.limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    const meta: PaginationMetaDto = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit),
      hasNextPage: query.page < Math.ceil(totalItems / query.limit),
      hasPreviousPage: query.page > 1,
    };

    return { data, meta };
  }

  async findDeletedPaginated(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponseDto<Category>> {
    const queryBuilder = this.createQueryBuilder('category')
      .withDeleted()
      .where('category.deletedAt IS NOT NULL'); // Solo elementos eliminados

    // Incluir relaciones según los parámetros
    if (query.includeChildren) {
      queryBuilder.leftJoinAndSelect('category.children', 'children');
    }

    queryBuilder.leftJoinAndSelect('category.parent', 'parent');

    // Aplicar búsqueda
    if (query.search) {
      queryBuilder.andWhere(
        '(category.name ILIKE :search OR category.description ILIKE :search OR category.slug ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Aplicar ordenamiento por fecha de eliminación por defecto
    queryBuilder.orderBy('category.deletedAt', 'DESC');
    queryBuilder.addOrderBy('category.sortOrder', 'ASC');

    // Aplicar paginación
    const offset = (query.page - 1) * query.limit;
    queryBuilder.skip(offset).take(query.limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    const meta: PaginationMetaDto = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit),
      hasNextPage: query.page < Math.ceil(totalItems / query.limit),
      hasPreviousPage: query.page > 1,
    };

    return { data, meta };
  }

  // ==================== MÉTODOS DE BÚSQUEDA ====================

  // async findBySlug(slug: string): Promise<Category | null> {
  //   return this.findOne({
  //     where: { slug },
  //     relations: ['parent', 'children'],
  //   });
  // }

  async findBySlug(
    slug: string,
    includeDeleted: boolean = false,
  ): Promise<Category | null> {
    const queryBuilder = this.createQueryBuilder('category')
      .where('category.slug = :slug', { slug })
      .leftJoinAndSelect('category.parent', 'parent')
      .leftJoinAndSelect('category.children', 'children');

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    return queryBuilder.getOne();
  }

  async findBySlugExcludingDeleted(slug: string): Promise<Category | null> {
    return this.findOne({
      where: { slug },
      relations: ['parent', 'children'],
      // Por defecto TypeORM excluye los soft-deleted, pero lo hacemos explícito
    });
  }

  async isSlugAvailableForCreate(slug: string): Promise<boolean> {
    const existingCategory = await this.createQueryBuilder('category')
      .where('category.slug = :slug', { slug })
      .withDeleted() // Incluir eliminados para verificar conflictos
      .getOne();

    return !existingCategory;
  }

  async isSlugAvailableForUpdate(
    slug: string,
    excludeId?: string,
  ): Promise<boolean> {
    const queryBuilder = this.createQueryBuilder('category').where(
      'category.slug = :slug',
      { slug },
    );

    if (excludeId) {
      queryBuilder.andWhere('category.id != :excludeId', { excludeId });
    }

    // No incluir eliminados en la verificación de update
    const existingCategory = await queryBuilder.getOne();
    return !existingCategory;
  }

  async search(searchTerm: string, limit: number = 10): Promise<Category[]> {
    return this.createQueryBuilder('category')
      .where(
        '(category.name ILIKE :search OR category.description ILIKE :search OR category.slug ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .andWhere('category.status = :status', { status: CategoryStatus.ACTIVE })
      .orderBy('category.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  async getAllSlugs(): Promise<string[]> {
    const categories = await this.createQueryBuilder('category')
      .select('category.slug')
      .getMany();

    return categories.map((cat) => cat.slug);
  }

  // ==================== MÉTODOS DE ÁRBOL ====================

  async findTree(): Promise<Category[]> {
    return this.find({
      where: {
        parentId: null,
        status: CategoryStatus.ACTIVE,
      },
      relations: ['children'],
      order: { sortOrder: 'ASC' },
    });
  }

  async findFullTree(): Promise<Category[]> {
    // Obtener todo el árbol con todas las relaciones
    const categories = await this.createQueryBuilder('category')
      .leftJoinAndSelect('category.children', 'children')
      .leftJoinAndSelect('children.children', 'grandchildren')
      .leftJoinAndSelect('grandchildren.children', 'greatgrandchildren')
      .where('category.parentId IS NULL')
      .andWhere('category.status = :status', { status: CategoryStatus.ACTIVE })
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('children.sortOrder', 'ASC')
      .addOrderBy('grandchildren.sortOrder', 'ASC')
      .addOrderBy('greatgrandchildren.sortOrder', 'ASC')
      .getMany();

    return categories;
  }

  // ==================== MÉTODOS ESPECIALIZADOS ====================

  async findParentCategories(): Promise<Category[]> {
    return this.createQueryBuilder('category')
      .leftJoin('category.children', 'children')
      .where('children.id IS NOT NULL')
      .andWhere('category.status = :status', { status: CategoryStatus.ACTIVE })
      .orderBy('category.sortOrder', 'ASC')
      .getMany();
  }

  async findCategoriesWithProductCount(): Promise<Category[]> {
    return this.createQueryBuilder('category')
      .where('category.status = :status', { status: CategoryStatus.ACTIVE })
      .loadRelationCountAndMap('category.productsCount', 'category.products')
      .orderBy('category.sortOrder', 'ASC')
      .getMany();
  }

  async findCategoriesWithoutProducts(): Promise<Category[]> {
    return this.createQueryBuilder('category')
      .leftJoin('category.products', 'product')
      .where('product.id IS NULL')
      .andWhere('category.status = :status', { status: CategoryStatus.ACTIVE })
      .orderBy('category.sortOrder', 'ASC')
      .getMany();
  }

  async findTopLevelCategories(): Promise<Category[]> {
    return this.find({
      where: {
        parentId: null,
        status: CategoryStatus.ACTIVE,
      },
      order: { sortOrder: 'ASC' },
    });
  }

  async findChildrenOf(parentId: string): Promise<Category[]> {
    return this.find({
      where: {
        parentId,
        status: CategoryStatus.ACTIVE,
      },
      order: { sortOrder: 'ASC' },
    });
  }

  // ==================== MÉTODOS DE UTILIDAD ====================

  async getMaxSortOrder(parentId?: string): Promise<number> {
    const query = this.createQueryBuilder('category').select(
      'MAX(category.sortOrder)',
      'maxOrder',
    );

    if (parentId) {
      query.where('category.parentId = :parentId', { parentId });
    } else {
      query.where('category.parentId IS NULL');
    }

    const result = await query.getRawOne();
    return result.maxOrder || 0;
  }

  async getMinSortOrder(parentId?: string): Promise<number> {
    const query = this.createQueryBuilder('category').select(
      'MIN(category.sortOrder)',
      'minOrder',
    );

    if (parentId) {
      query.where('category.parentId = :parentId', { parentId });
    } else {
      query.where('category.parentId IS NULL');
    }

    const result = await query.getRawOne();
    return result.minOrder || 0;
  }

  async countByStatus(status: CategoryStatus): Promise<number> {
    return this.count({ where: { status } });
  }

  async countByParent(parentId: string): Promise<number> {
    return this.count({ where: { parentId } });
  }

  async countChildrenRecursive(categoryId: string): Promise<number> {
    // Contar todos los descendientes de una categoría
    const query = `
      WITH RECURSIVE category_tree AS (
        SELECT id, parent_id, 1 as level
        FROM categories
        WHERE parent_id = $1 AND deleted_at IS NULL
        
        UNION ALL
        
        SELECT c.id, c.parent_id, ct.level + 1
        FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.deleted_at IS NULL AND ct.level < 10
      )
      SELECT COUNT(*) as total FROM category_tree;
    `;

    const result = await this.query(query, [categoryId]);
    return parseInt(result[0]?.total || '0');
  }

  // ==================== MÉTODOS DE VALIDACIÓN ====================

  async hasCircularReference(
    categoryId: string,
    newParentId: string,
  ): Promise<boolean> {
    // Verificar si asignar newParentId como padre de categoryId crearía un ciclo
    const query = `
      WITH RECURSIVE parent_chain AS (
        SELECT id, parent_id, 1 as level
        FROM categories
        WHERE id = $1 AND deleted_at IS NULL
        
        UNION ALL
        
        SELECT c.id, c.parent_id, pc.level + 1
        FROM categories c
        INNER JOIN parent_chain pc ON c.id = pc.parent_id
        WHERE c.deleted_at IS NULL AND pc.level < 10
      )
      SELECT COUNT(*) as found FROM parent_chain WHERE id = $2;
    `;

    const result = await this.query(query, [newParentId, categoryId]);
    return parseInt(result[0]?.found || '0') > 0;
  }

  async getCategoryDepth(categoryId: string): Promise<number> {
    const query = `
      WITH RECURSIVE parent_chain AS (
        SELECT id, parent_id, 0 as depth
        FROM categories
        WHERE id = $1 AND deleted_at IS NULL
        
        UNION ALL
        
        SELECT c.id, c.parent_id, pc.depth + 1
        FROM categories c
        INNER JOIN parent_chain pc ON c.id = pc.parent_id
        WHERE c.deleted_at IS NULL AND pc.depth < 10
      )
      SELECT MAX(depth) as max_depth FROM parent_chain;
    `;

    const result = await this.query(query, [categoryId]);
    return parseInt(result[0]?.max_depth || '0');
  }

  // ==================== MÉTODOS PRIVADOS ====================

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Category>,
    query: CategoryQueryDto,
  ): void {
    if (query.status) {
      queryBuilder.andWhere('category.status = :status', {
        status: query.status,
      });
    }

    if (query.parentId) {
      queryBuilder.andWhere('category.parentId = :parentId', {
        parentId: query.parentId,
      });
    }

    if (query.onlyParents) {
      queryBuilder.andWhere('category.parentId IS NULL');
    }
  }
}
