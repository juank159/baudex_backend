// // src/modules/products/repositories/product.repository.ts - COMPLETAMENTE CORREGIDO
// import { Injectable } from '@nestjs/common';
// import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
// import { Product, ProductStatus } from '../entities/product.entity';
// import { ProductQueryDto } from '../dto/product-query.dto';
// import {
//   PaginatedResponseDto,
//   PaginationMetaDto,
// } from '../../common/dto/pagination-response.dto';
// import { PriceStatus, PriceType } from '../entities/product-price.entity';

// @Injectable()
// export class ProductRepository extends Repository<Product> {
//   constructor(private dataSource: DataSource) {
//     super(Product, dataSource.createEntityManager());
//   }

//   async findAllPaginated(
//     query: ProductQueryDto,
//   ): Promise<PaginatedResponseDto<Product>> {
//     const queryBuilder = this.createQueryBuilder('product');

//     // Incluir relaciones según los parámetros
//     if (query.includeCategory) {
//       queryBuilder.leftJoinAndSelect('product.category', 'category');
//     }

//     if (query.includePrices) {
//       queryBuilder.leftJoinAndSelect('product.prices', 'prices');
//     }

//     if (query.includeCreatedBy) {
//       queryBuilder.leftJoinAndSelect('product.createdBy', 'createdBy');
//     }

//     // Aplicar filtros básicos
//     this.applyFilters(queryBuilder, query);

//     // Aplicar filtros de precio SI se especificaron
//     if (query.minPrice !== undefined || query.maxPrice !== undefined) {
//       this.applyPriceFilters(queryBuilder, query);
//     }

//     // Aplicar búsqueda
//     if (query.search) {
//       queryBuilder.andWhere(
//         '(product.name ILIKE :search OR product.description ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
//         { search: `%${query.search}%` },
//       );
//     }

//     // Aplicar ordenamiento
//     queryBuilder.orderBy(`product.${query.sortBy}`, query.sortOrder);

//     // Aplicar paginación
//     const offset = (query.page - 1) * query.limit;
//     queryBuilder.skip(offset).take(query.limit);

//     const [data, totalItems] = await queryBuilder.getManyAndCount();

//     // ✅ SOLUCIÓN: Crear el meta como objeto literal usando la interface PaginationMetaDto
//     const meta: PaginationMetaDto = {
//       page: query.page,
//       limit: query.limit,
//       totalItems,
//       totalPages: Math.ceil(totalItems / query.limit),
//       hasNextPage: query.page < Math.ceil(totalItems / query.limit),
//       hasPreviousPage: query.page > 1,
//     };

//     return { data, meta };
//   }

//   async findBySku(sku: string): Promise<Product | null> {
//     return this.findOne({
//       where: { sku },
//       relations: ['category', 'prices', 'createdBy'],
//     });
//   }

//   async findByBarcode(barcode: string): Promise<Product | null> {
//     return this.findOne({
//       where: { barcode },
//       relations: ['category', 'prices', 'createdBy'],
//     });
//   }

//   async findBySkuOrBarcode(code: string): Promise<Product | null> {
//     return this.createQueryBuilder('product')
//       .leftJoinAndSelect('product.category', 'category')
//       .leftJoinAndSelect('product.prices', 'prices')
//       .leftJoinAndSelect('product.createdBy', 'createdBy')
//       .where('product.sku = :code OR product.barcode = :code', { code })
//       .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
//       .getOne();
//   }

//   async searchProducts(
//     searchTerm: string,
//     limit: number = 20,
//   ): Promise<Product[]> {
//     return this.createQueryBuilder('product')
//       .leftJoinAndSelect('product.category', 'category')
//       .leftJoinAndSelect('product.prices', 'prices')
//       .leftJoinAndSelect('product.createdBy', 'createdBy')
//       .where(
//         '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
//         { search: `%${searchTerm}%` },
//       )
//       .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
//       .orderBy('product.name', 'ASC')
//       .limit(limit)
//       .getMany();
//   }

//   async findLowStockProducts(): Promise<Product[]> {
//     return this.createQueryBuilder('product')
//       .where('product.stock <= product.minStock')
//       .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
//       .leftJoinAndSelect('product.category', 'category')
//       .leftJoinAndSelect('product.prices', 'prices')
//       .leftJoinAndSelect('product.createdBy', 'createdBy')
//       .orderBy('product.stock', 'ASC')
//       .getMany();
//   }

//   async findOutOfStockProducts(): Promise<Product[]> {
//     return this.find({
//       where: [{ stock: 0 }, { status: ProductStatus.OUT_OF_STOCK }],
//       relations: ['category', 'prices', 'createdBy'],
//       order: { updatedAt: 'DESC' },
//     });
//   }

//   async getProductsByCategory(categoryId: string): Promise<Product[]> {
//     return this.find({
//       where: {
//         categoryId, // ✅ SOLUCIÓN: Usar categoryId (camelCase) como en la entidad corregida
//         status: ProductStatus.ACTIVE,
//       },
//       relations: ['prices', 'category', 'createdBy'],
//       order: { name: 'ASC' },
//     });
//   }

//   async updateStock(
//     id: string,
//     quantity: number,
//     operation: 'add' | 'subtract',
//   ): Promise<void> {
//     const product = await this.findOne({ where: { id } });
//     if (!product) return;

//     if (operation === 'add') {
//       product.stock += quantity;
//     } else {
//       product.stock = Math.max(0, product.stock - quantity);
//     }

//     // Actualizar estado si se queda sin stock
//     if (product.stock === 0) {
//       product.status = ProductStatus.OUT_OF_STOCK;
//     } else if (
//       product.status === ProductStatus.OUT_OF_STOCK &&
//       product.stock > 0
//     ) {
//       product.status = ProductStatus.ACTIVE;
//     }

//     await this.save(product);
//   }

//   async getProductStats(): Promise<{
//     total: number;
//     active: number;
//     inactive: number;
//     outOfStock: number;
//     lowStock: number;
//   }> {
//     const total = await this.count();
//     const active = await this.count({
//       where: { status: ProductStatus.ACTIVE },
//     });
//     const inactive = await this.count({
//       where: { status: ProductStatus.INACTIVE },
//     });
//     const outOfStock = await this.count({
//       where: { status: ProductStatus.OUT_OF_STOCK },
//     });

//     // Productos con stock bajo
//     const lowStock = await this.createQueryBuilder('product')
//       .where('product.stock <= product.minStock')
//       .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
//       .getCount();

//     return {
//       total,
//       active,
//       inactive,
//       outOfStock,
//       lowStock,
//     };
//   }

//   async getStockValue(): Promise<number> {
//     const result = await this.createQueryBuilder('product')
//       .leftJoin('product.prices', 'price')
//       .select('SUM(product.stock * price.amount)', 'totalValue')
//       .where('product.status = :status', { status: ProductStatus.ACTIVE })
//       .andWhere('price.type = :priceType', { priceType: 'cost' })
//       .andWhere('price.status = :priceStatus', {
//         priceStatus: PriceStatus.ACTIVE,
//       })
//       .getRawOne();

//     return parseFloat(result.totalValue) || 0;
//   }

//   async findProductsWithLowStock(threshold?: number): Promise<Product[]> {
//     const queryBuilder = this.createQueryBuilder('product')
//       .leftJoinAndSelect('product.category', 'category')
//       .leftJoinAndSelect('product.prices', 'prices')
//       .leftJoinAndSelect('product.createdBy', 'createdBy')
//       .where('product.status = :status', { status: ProductStatus.ACTIVE });

//     if (threshold !== undefined) {
//       queryBuilder.andWhere('product.stock <= :threshold', { threshold });
//     } else {
//       queryBuilder.andWhere('product.stock <= product.minStock');
//     }

//     return queryBuilder.orderBy('product.stock', 'ASC').getMany();
//   }

//   async findTopProducts(limit: number = 10): Promise<Product[]> {
//     return this.find({
//       where: { status: ProductStatus.ACTIVE },
//       relations: ['category', 'prices', 'createdBy'],
//       order: { createdAt: 'DESC' },
//       take: limit,
//     });
//   }

//   async findActiveByIds(ids: string[]): Promise<Product[]> {
//     return this.createQueryBuilder('product')
//       .where('product.id IN (:...ids)', { ids })
//       .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
//       .leftJoinAndSelect('product.prices', 'prices')
//       .leftJoinAndSelect('product.category', 'category')
//       .leftJoinAndSelect('product.createdBy', 'createdBy')
//       .orderBy('product.name', 'ASC')
//       .getMany();
//   }

//   async countByCategory(categoryId: string): Promise<number> {
//     return this.count({
//       where: {
//         categoryId, // ✅ SOLUCIÓN: Usar categoryId (camelCase)
//         status: ProductStatus.ACTIVE,
//       },
//     });
//   }

//   async findBestSellingProducts(limit: number = 10): Promise<Product[]> {
//     return this.find({
//       where: { status: ProductStatus.ACTIVE },
//       relations: ['category', 'prices', 'createdBy'],
//       order: { createdAt: 'DESC' },
//       take: limit,
//     });
//   }

//   async findProductsNeedingRestock(): Promise<Product[]> {
//     return this.createQueryBuilder('product')
//       .where('product.stock <= product.minStock')
//       .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
//       .leftJoinAndSelect('product.category', 'category')
//       .leftJoinAndSelect('product.createdBy', 'createdBy')
//       .orderBy('product.stock', 'ASC')
//       .getMany();
//   }

//   private applyFilters(
//     queryBuilder: SelectQueryBuilder<Product>,
//     query: ProductQueryDto,
//   ): void {
//     if (query.status) {
//       queryBuilder.andWhere('product.status = :status', {
//         status: query.status,
//       });
//     }

//     if (query.type) {
//       queryBuilder.andWhere('product.type = :type', { type: query.type });
//     }

//     if (query.categoryId) {
//       queryBuilder.andWhere('product.categoryId = :categoryId', {
//         categoryId: query.categoryId,
//       });
//     }

//     if (query.createdById) {
//       queryBuilder.andWhere('product.createdById = :createdById', {
//         createdById: query.createdById,
//       });
//     }

//     if (query.inStock) {
//       queryBuilder.andWhere('product.stock > 0');
//       queryBuilder.andWhere('product.status != :outOfStock', {
//         outOfStock: ProductStatus.OUT_OF_STOCK,
//       });
//     }

//     if (query.lowStock) {
//       queryBuilder.andWhere('product.stock <= product.minStock');
//     }
//   }

//   private applyPriceFilters(
//     queryBuilder: SelectQueryBuilder<Product>,
//     query: ProductQueryDto,
//   ): void {
//     // Crear un join específico para filtros de precio
//     queryBuilder.leftJoin('product.prices', 'price_filter');

//     // Aplicar filtros de tipo de precio
//     if (query.priceType) {
//       queryBuilder.andWhere('price_filter.type = :priceType', {
//         priceType: query.priceType,
//       });
//     }

//     // Solo precios activos
//     queryBuilder.andWhere('price_filter.status = :priceStatus', {
//       priceStatus: PriceStatus.ACTIVE,
//     });

//     // Filtros de rango de precio
//     if (query.minPrice !== undefined) {
//       queryBuilder.andWhere('price_filter.amount >= :minPrice', {
//         minPrice: query.minPrice,
//       });
//     }

//     if (query.maxPrice !== undefined) {
//       queryBuilder.andWhere('price_filter.amount <= :maxPrice', {
//         maxPrice: query.maxPrice,
//       });
//     }
//   }
// }

import { Injectable } from '@nestjs/common';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { ProductQueryDto } from '../dto/product-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/pagination-response.dto';
import { PriceStatus, PriceType } from '../entities/product-price.entity';

@Injectable()
export class ProductRepository extends Repository<Product> {
  constructor(private dataSource: DataSource) {
    super(Product, dataSource.createEntityManager());
  }

  async findAllPaginated(
    query: ProductQueryDto,
  ): Promise<PaginatedResponseDto<Product>> {
    const queryBuilder = this.createQueryBuilder('product');

    // Incluir relaciones según los parámetros
    if (query.includeCategory) {
      queryBuilder.leftJoinAndSelect('product.category', 'category');
    }

    if (query.includePrices) {
      queryBuilder.leftJoinAndSelect('product.prices', 'prices');
    }

    if (query.includeCreatedBy) {
      queryBuilder.leftJoinAndSelect('product.createdBy', 'createdBy');
    }

    // Aplicar filtros básicos
    this.applyFilters(queryBuilder, query);

    // Aplicar filtros de precio SI se especificaron
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      this.applyPriceFilters(queryBuilder, query);
    }

    // Aplicar búsqueda
    if (query.search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // ✅ CORREGIDO: Aplicar ordenamiento con verificación de propiedades
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder.orderBy(`product.${sortField}`, sortOrder);

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

  async findBySku(sku: string): Promise<Product | null> {
    return this.findOne({
      where: { sku },
      relations: ['category', 'prices', 'createdBy'],
    });
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    return this.findOne({
      where: { barcode },
      relations: ['category', 'prices', 'createdBy'],
    });
  }

  async findBySkuOrBarcode(code: string): Promise<Product | null> {
    return this.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .where('product.sku = :code OR product.barcode = :code', { code })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .getOne();
  }

  async searchProducts(
    searchTerm: string,
    limit: number = 20,
  ): Promise<Product[]> {
    return this.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .where(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .orderBy('product.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  async findLowStockProducts(): Promise<Product[]> {
    return this.createQueryBuilder('product')
      .where('product.stock <= product.minStock')
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .orderBy('product.stock', 'ASC')
      .getMany();
  }

  async findOutOfStockProducts(): Promise<Product[]> {
    return this.find({
      where: [{ stock: 0 }, { status: ProductStatus.OUT_OF_STOCK }],
      relations: ['category', 'prices', 'createdBy'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return this.find({
      where: {
        categoryId,
        status: ProductStatus.ACTIVE,
      },
      relations: ['prices', 'category', 'createdBy'],
      order: { name: 'ASC' },
    });
  }

  async updateStock(
    id: string,
    quantity: number,
    operation: 'add' | 'subtract',
  ): Promise<void> {
    const product = await this.findOne({ where: { id } });
    if (!product) return;

    if (operation === 'add') {
      product.stock += quantity;
    } else {
      product.stock = Math.max(0, product.stock - quantity);
    }

    // Actualizar estado si se queda sin stock
    if (product.stock === 0) {
      product.status = ProductStatus.OUT_OF_STOCK;
    } else if (
      product.status === ProductStatus.OUT_OF_STOCK &&
      product.stock > 0
    ) {
      product.status = ProductStatus.ACTIVE;
    }

    await this.save(product);
  }

  // ✅ CORREGIDO: Cambiar nombres de propiedades para que coincidan con el service
  // async getProductStats(): Promise<{
  //   totalProducts: number;
  //   activeProducts: number;
  //   inactiveProducts: number;
  //   outOfStockProducts: number;
  //   lowStockProducts: number;
  //   // Mantener también las propiedades originales por compatibilidad
  //   total: number;
  //   active: number;
  //   inactive: number;
  //   outOfStock: number;
  //   lowStock: number;
  // }> {
  //   const total = await this.count();
  //   const active = await this.count({
  //     where: { status: ProductStatus.ACTIVE },
  //   });
  //   const inactive = await this.count({
  //     where: { status: ProductStatus.INACTIVE },
  //   });
  //   const outOfStock = await this.count({
  //     where: { status: ProductStatus.OUT_OF_STOCK },
  //   });

  //   // Productos con stock bajo
  //   const lowStock = await this.createQueryBuilder('product')
  //     .where('product.stock <= product.minStock')
  //     .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
  //     .getCount();

  //   return {
  //     // ✅ Nuevas propiedades que espera el service
  //     totalProducts: total,
  //     activeProducts: active,
  //     inactiveProducts: inactive,
  //     outOfStockProducts: outOfStock,
  //     lowStockProducts: lowStock,
  //     // Mantener compatibilidad con nombres originales
  //     total,
  //     active,
  //     inactive,
  //     outOfStock,
  //     lowStock,
  //   };
  // }

  async getProductStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    outOfStock: number;
    lowStock: number;
    // Mantener ambos nombres para compatibilidad
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    outOfStockProducts: number;
    lowStockProducts: number;
  }> {
    console.log('🔍 ProductRepository: Calculando estadísticas...');

    try {
      const total = await this.count();
      console.log(`📊 Total de productos: ${total}`);

      const active = await this.count({
        where: { status: ProductStatus.ACTIVE },
      });
      console.log(`✅ Productos activos: ${active}`);

      const inactive = await this.count({
        where: { status: ProductStatus.INACTIVE },
      });
      console.log(`❌ Productos inactivos: ${inactive}`);

      const outOfStock = await this.count({
        where: { status: ProductStatus.OUT_OF_STOCK },
      });
      console.log(`🚫 Productos sin stock: ${outOfStock}`);

      // Productos con stock bajo
      const lowStock = await this.createQueryBuilder('product')
        .where('product.stock <= product.minStock')
        .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
        .getCount();
      console.log(`⚠️ Productos con stock bajo: ${lowStock}`);

      const stats = {
        // Nombres originales (PRINCIPALES)
        total,
        active,
        inactive,
        outOfStock,
        lowStock,
        // Nombres alternativos (para compatibilidad)
        totalProducts: total,
        activeProducts: active,
        inactiveProducts: inactive,
        outOfStockProducts: outOfStock,
        lowStockProducts: lowStock,
      };

      console.log('✅ ProductRepository: Estadísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error(
        '❌ ProductRepository: Error al calcular estadísticas:',
        error,
      );
      // Retornar estadísticas vacías en caso de error
      return {
        total: 0,
        active: 0,
        inactive: 0,
        outOfStock: 0,
        lowStock: 0,
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
      };
    }
  }

  async getStockValue(): Promise<number> {
    const result = await this.createQueryBuilder('product')
      .leftJoin('product.prices', 'price')
      .select('SUM(product.stock * price.amount)', 'totalValue')
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('price.type = :priceType', { priceType: 'cost' })
      .andWhere('price.status = :priceStatus', {
        priceStatus: PriceStatus.ACTIVE,
      })
      .getRawOne();

    return parseFloat(result.totalValue) || 0;
  }

  async findProductsWithLowStock(threshold?: number): Promise<Product[]> {
    const queryBuilder = this.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .where('product.status = :status', { status: ProductStatus.ACTIVE });

    if (threshold !== undefined) {
      queryBuilder.andWhere('product.stock <= :threshold', { threshold });
    } else {
      queryBuilder.andWhere('product.stock <= product.minStock');
    }

    return queryBuilder.orderBy('product.stock', 'ASC').getMany();
  }

  async findTopProducts(limit: number = 10): Promise<Product[]> {
    return this.find({
      where: { status: ProductStatus.ACTIVE },
      relations: ['category', 'prices', 'createdBy'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findActiveByIds(ids: string[]): Promise<Product[]> {
    return this.createQueryBuilder('product')
      .where('product.id IN (:...ids)', { ids })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .orderBy('product.name', 'ASC')
      .getMany();
  }

  async countByCategory(categoryId: string): Promise<number> {
    return this.count({
      where: {
        categoryId,
        status: ProductStatus.ACTIVE,
      },
    });
  }

  async findBestSellingProducts(limit: number = 10): Promise<Product[]> {
    return this.find({
      where: { status: ProductStatus.ACTIVE },
      relations: ['category', 'prices', 'createdBy'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findProductsNeedingRestock(): Promise<Product[]> {
    return this.createQueryBuilder('product')
      .where('product.stock <= product.minStock')
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .orderBy('product.stock', 'ASC')
      .getMany();
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Product>,
    query: ProductQueryDto,
  ): void {
    if (query.status) {
      queryBuilder.andWhere('product.status = :status', {
        status: query.status,
      });
    }

    if (query.type) {
      queryBuilder.andWhere('product.type = :type', { type: query.type });
    }

    if (query.categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.createdById) {
      queryBuilder.andWhere('product.createdById = :createdById', {
        createdById: query.createdById,
      });
    }

    if (query.inStock) {
      queryBuilder.andWhere('product.stock > 0');
      queryBuilder.andWhere('product.status != :outOfStock', {
        outOfStock: ProductStatus.OUT_OF_STOCK,
      });
    }

    if (query.lowStock) {
      queryBuilder.andWhere('product.stock <= product.minStock');
    }
  }

  private applyPriceFilters(
    queryBuilder: SelectQueryBuilder<Product>,
    query: ProductQueryDto,
  ): void {
    queryBuilder.leftJoin('product.prices', 'price_filter');

    if (query.priceType) {
      queryBuilder.andWhere('price_filter.type = :priceType', {
        priceType: query.priceType,
      });
    }

    queryBuilder.andWhere('price_filter.status = :priceStatus', {
      priceStatus: PriceStatus.ACTIVE,
    });

    if (query.minPrice !== undefined) {
      queryBuilder.andWhere('price_filter.amount >= :minPrice', {
        minPrice: query.minPrice,
      });
    }

    if (query.maxPrice !== undefined) {
      queryBuilder.andWhere('price_filter.amount <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }
  }
}
