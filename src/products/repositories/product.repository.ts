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
import { TenantAwareService } from '../../common/services/tenant-aware.service';

@Injectable()
export class ProductRepository extends Repository<Product> {
  constructor(
    private dataSource: DataSource,
    private tenantAwareService: TenantAwareService,
  ) {
    super(Product, dataSource.createEntityManager());
  }

  async findAllPaginated(
    query: ProductQueryDto,
  ): Promise<PaginatedResponseDto<Product>> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    const queryBuilder = this.createQueryBuilder('product');

    // ✅ MULTITENANT FIX: Filtrar por organización
    queryBuilder.where('product.organizationId = :organizationId', {
      organizationId: tenantId,
    });

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
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.findOne({
      where: { sku, organizationId: tenantId },
      relations: ['category', 'prices', 'createdBy'],
    });
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.findOne({
      where: { barcode, organizationId: tenantId },
      relations: ['category', 'prices', 'createdBy'],
    });
  }

  async findBySkuOrBarcode(code: string): Promise<Product | null> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('(product.sku = :code OR product.barcode = :code)', { code })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .getOne();
  }

  async searchProducts(
    searchTerm: string,
    limit: number = 20,
  ): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .orderBy('product.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  // async findLowStockProducts(): Promise<Product[]> {
  //   console.log('🔍 ProductRepository: Buscando productos con stock bajo...');

  //   const products = await this.createQueryBuilder('product')
  //     .where('product.stock <= product.minStock')
  //     .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
  //     .andWhere('product.stock > 0') // ✅ AÑADIDO: Excluir productos sin stock
  //     .andWhere('product.deleted_at IS NULL') // ✅ EXPLÍCITO: Asegurar no eliminados
  //     .leftJoinAndSelect('product.category', 'category')
  //     .leftJoinAndSelect('product.prices', 'prices')
  //     .leftJoinAndSelect('product.createdBy', 'createdBy')
  //     .orderBy('product.stock', 'ASC')
  //     .addOrderBy('product.minStock', 'DESC') // ✅ AÑADIDO: Orden secundario
  //     .getMany();

  //   console.log(`📋 Productos con stock bajo encontrados: ${products.length}`);
  //   products.forEach((p) => {
  //     console.log(`   - ${p.name}: stock=${p.stock}, minStock=${p.minStock}`);
  //   });

  //   return products;
  // }

  // ⚡ OPTIMIZACIÓN: Query mejorada que hace la comparación en la base de datos
  async findLowStockProducts(): Promise<Product[]> {
    console.log('🔍 ProductRepository: Buscando productos con stock bajo...');

    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    // ✅ OPTIMIZACIÓN: Hacer la comparación en la BD en lugar de en memoria
    const lowStockProducts = await this.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('product.deletedAt IS NULL')
      // ⚡ Comparación en la base de datos (mucho más eficiente)
      .andWhere('CAST(product.stock AS DECIMAL) <= CAST(product.minStock AS DECIMAL)')
      .orderBy('CAST(product.stock AS DECIMAL)', 'ASC')
      .getMany();

    console.log(
      `📋 Productos con stock bajo encontrados: ${lowStockProducts.length}`,
    );

    return lowStockProducts;
  }

  async findOutOfStockProducts(): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.find({
      where: [
        { organizationId: tenantId, stock: 0 },
        { organizationId: tenantId, status: ProductStatus.OUT_OF_STOCK },
      ],
      relations: ['category', 'prices', 'createdBy'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.find({
      where: {
        organizationId: tenantId,
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
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    const product = await this.findOne({
      where: { id, organizationId: tenantId },
    });
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

  // async getProductStats(): Promise<{
  //   total: number;
  //   active: number;
  //   inactive: number;
  //   outOfStock: number;
  //   lowStock: number;
  //   totalProducts: number;
  //   activeProducts: number;
  //   inactiveProducts: number;
  //   outOfStockProducts: number;
  //   lowStockProducts: number;
  // }> {
  //   console.log('🔍 ProductRepository: Calculando estadísticas...');

  //   try {
  //     const total = await this.count();
  //     console.log(`📊 Total de productos: ${total}`);

  //     const active = await this.count({
  //       where: { status: ProductStatus.ACTIVE },
  //     });
  //     console.log(`✅ Productos activos: ${active}`);

  //     const inactive = await this.count({
  //       where: { status: ProductStatus.INACTIVE },
  //     });
  //     console.log(`❌ Productos inactivos: ${inactive}`);

  //     const outOfStock = await this.count({
  //       where: { status: ProductStatus.OUT_OF_STOCK },
  //     });
  //     console.log(`🚫 Productos sin stock: ${outOfStock}`);

  //     // ✅ SOLUCIÓN FINAL: Solo stock <= minStock (usando minStock individual)
  //     console.log('🔍 Consultando productos para calcular stock bajo...');

  //     const allProducts = await this.find({
  //       where: {
  //         deletedAt: null,
  //       },
  //       select: ['id', 'name', 'stock', 'minStock', 'status'],
  //     });

  //     console.log(
  //       `📋 Productos encontrados para análisis: ${allProducts.length}`,
  //     );

  //     let lowStockCount = 0;
  //     const lowStockDebugList = [];

  //     for (const product of allProducts) {
  //       // ✅ LÓGICA FINAL: Solo stock <= minStock (cada producto usa su propio minStock)
  //       const isLowStock = product.stock <= product.minStock;

  //       console.log(
  //         `🔍 Analizando ${product.name}: stock=${product.stock}, minStock=${product.minStock}, status=${product.status}, isLowStock=${isLowStock}`,
  //       );

  //       if (isLowStock) {
  //         lowStockCount++;
  //         lowStockDebugList.push({
  //           name: product.name,
  //           stock: product.stock,
  //           minStock: product.minStock,
  //           status: product.status,
  //         });
  //       }
  //     }

  //     console.log(`⚠️ Productos con stock bajo calculados: ${lowStockCount}`);
  //     console.log('🔍 Lista de productos con stock bajo:', lowStockDebugList);

  //     const stats = {
  //       total,
  //       active,
  //       inactive,
  //       outOfStock,
  //       lowStock: lowStockCount,
  //       totalProducts: total,
  //       activeProducts: active,
  //       inactiveProducts: inactive,
  //       outOfStockProducts: outOfStock,
  //       lowStockProducts: lowStockCount,
  //     };

  //     console.log('✅ ProductRepository: Estadísticas calculadas:', stats);
  //     return stats;
  //   } catch (error) {
  //     console.error(
  //       '❌ ProductRepository: Error al calcular estadísticas:',
  //       error,
  //     );
  //     return {
  //       total: 0,
  //       active: 0,
  //       inactive: 0,
  //       outOfStock: 0,
  //       lowStock: 0,
  //       totalProducts: 0,
  //       activeProducts: 0,
  //       inactiveProducts: 0,
  //       outOfStockProducts: 0,
  //       lowStockProducts: 0,
  //     };
  //   }
  // }

  async getProductStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    outOfStock: number;
    lowStock: number;
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    outOfStockProducts: number;
    lowStockProducts: number;
  }> {
    console.log('🔍 ProductRepository: Calculando estadísticas...');

    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    try {
      const total = await this.count({
        where: { organizationId: tenantId },
      });
      console.log(`📊 Total de productos: ${total}`);

      const active = await this.count({
        where: { organizationId: tenantId, status: ProductStatus.ACTIVE },
      });
      console.log(`✅ Productos activos: ${active}`);

      const inactive = await this.count({
        where: { organizationId: tenantId, status: ProductStatus.INACTIVE },
      });
      console.log(`❌ Productos inactivos: ${inactive}`);

      const outOfStock = await this.count({
        where: { organizationId: tenantId, status: ProductStatus.OUT_OF_STOCK },
      });
      console.log(`🚫 Productos sin stock: ${outOfStock}`);

      // ✅ CORRECCIÓN: Calcular stock bajo con conversión a números
      console.log('🔍 Consultando productos para calcular stock bajo...');

      const allProducts = await this.find({
        where: {
          organizationId: tenantId,
          deletedAt: null,
        },
        select: ['id', 'name', 'stock', 'minStock', 'status'],
      });

      console.log(
        `📋 Productos encontrados para análisis: ${allProducts.length}`,
      );

      let lowStockCount = 0;
      const lowStockDebugList = [];

      for (const product of allProducts) {
        // ✅ CORRECCIÓN: Convertir a números para comparación correcta
        const stock = Number(product.stock) || 0;
        const minStock = Number(product.minStock) || 0;
        const isLowStock = stock <= minStock;

        console.log(
          `🔍 Analizando ${product.name}: stock=${stock} (num), minStock=${minStock} (num), status=${product.status}, isLowStock=${isLowStock}`,
        );

        if (isLowStock) {
          lowStockCount++;
          lowStockDebugList.push({
            name: product.name,
            stock: stock, // ← Ahora como número
            minStock: minStock, // ← Ahora como número
            status: product.status,
          });
        }
      }

      console.log(`⚠️ Productos con stock bajo calculados: ${lowStockCount}`);
      console.log('🔍 Lista de productos con stock bajo:', lowStockDebugList);

      const stats = {
        total,
        active,
        inactive,
        outOfStock,
        lowStock: lowStockCount,
        totalProducts: total,
        activeProducts: active,
        inactiveProducts: inactive,
        outOfStockProducts: outOfStock,
        lowStockProducts: lowStockCount,
      };

      console.log('✅ ProductRepository: Estadísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error(
        '❌ ProductRepository: Error al calcular estadísticas:',
        error,
      );
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
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    const result = await this.createQueryBuilder('product')
      .leftJoin('product.prices', 'price')
      .select('SUM(product.stock * price.amount)', 'totalValue')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('price.type = :priceType', { priceType: 'cost' })
      .andWhere('price.status = :priceStatus', {
        priceStatus: PriceStatus.ACTIVE,
      })
      .getRawOne();

    return parseFloat(result.totalValue) || 0;
  }

  async findProductsWithLowStock(threshold?: number): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    const queryBuilder = this.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE });

    if (threshold !== undefined) {
      // ✅ CORRECCIÓN: Convertir threshold a número y usar CAST para comparación numérica
      const numericThreshold = Number(threshold) || 0;
      queryBuilder.andWhere('CAST(product.stock AS DECIMAL) <= :threshold', {
        threshold: numericThreshold,
      });
    } else {
      // ✅ CORRECCIÓN: Usar CAST para comparación numérica entre stock y minStock
      queryBuilder.andWhere(
        'CAST(product.stock AS DECIMAL) <= CAST(product.minStock AS DECIMAL)',
      );
    }

    const products = await queryBuilder
      .orderBy('CAST(product.stock AS DECIMAL)', 'ASC')
      .getMany();

    // ✅ FILTRO ADICIONAL: Si la DB no soporta CAST, filtrar en memoria
    return products.filter((product) => {
      const stock = Number(product.stock) || 0;
      const minStock = Number(product.minStock) || 0;
      const thresholdNum =
        threshold !== undefined ? Number(threshold) || 0 : minStock;

      return stock <= thresholdNum;
    });
  }

  async findTopProducts(limit: number = 10): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.find({
      where: { organizationId: tenantId, status: ProductStatus.ACTIVE },
      relations: ['category', 'prices', 'createdBy'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findActiveByIds(ids: string[]): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.createQueryBuilder('product')
      .where('product.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('product.id IN (:...ids)', { ids })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .leftJoinAndSelect('product.prices', 'prices')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.createdBy', 'createdBy')
      .orderBy('product.name', 'ASC')
      .getMany();
  }

  async countByCategory(categoryId: string): Promise<number> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.count({
      where: {
        organizationId: tenantId,
        categoryId,
        status: ProductStatus.ACTIVE,
      },
    });
  }

  async findBestSellingProducts(limit: number = 10): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    return this.find({
      where: { organizationId: tenantId, status: ProductStatus.ACTIVE },
      relations: ['category', 'prices', 'createdBy'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // async findProductsNeedingRestock(): Promise<Product[]> {
  //   return this.createQueryBuilder('product')
  //     .where('product.stock <= product.minStock')
  //     .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
  //     .leftJoinAndSelect('product.category', 'category')
  //     .leftJoinAndSelect('product.createdBy', 'createdBy')
  //     .orderBy('product.stock', 'ASC')
  //     .getMany();
  // }

  async findProductsNeedingRestock(): Promise<Product[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    // ✅ CORRECCIÓN: Usar el método corregido
    const allProducts = await this.find({
      where: {
        organizationId: tenantId,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      relations: ['category', 'createdBy'],
    });

    // Filtrar productos que necesitan restock usando comparación numérica
    const needingRestock = allProducts.filter((product) => {
      const stock = Number(product.stock) || 0;
      const minStock = Number(product.minStock) || 0;
      return stock <= minStock;
    });

    // Ordenar por stock ascendente
    return needingRestock.sort((a, b) => {
      const stockA = Number(a.stock) || 0;
      const stockB = Number(b.stock) || 0;
      return stockA - stockB;
    });
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

  async debugStockComparisons(): Promise<any[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not found');
    }

    const allProducts = await this.find({
      where: { organizationId: tenantId },
      select: ['id', 'name', 'stock', 'minStock', 'status'],
    });

    return allProducts.map((product) => {
      const stockOriginal = product.stock;
      const minStockOriginal = product.minStock;
      const stockNumber = Number(product.stock) || 0;
      const minStockNumber = Number(product.minStock) || 0;

      return {
        name: product.name,
        stockOriginal: stockOriginal,
        stockOriginalType: typeof stockOriginal,
        minStockOriginal: minStockOriginal,
        minStockOriginalType: typeof minStockOriginal,
        stockNumber: stockNumber,
        minStockNumber: minStockNumber,
        stringComparison: stockOriginal <= minStockOriginal,
        numberComparison: stockNumber <= minStockNumber,
        isLowStockCorrect: stockNumber <= minStockNumber,
      };
    });
  }
}
