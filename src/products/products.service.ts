import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Scope,
  Inject,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { ProductRepository } from './repositories/product.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Product, ProductStatus } from './entities/product.entity';
import {
  ProductPrice,
  PriceType,
  PriceStatus,
} from './entities/product-price.entity';
import { PaginatedResponseDto } from '../common/dto/pagination-response.dto';
import { CategoryService } from '../categories/categories.service';
import { DataSource } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TenantAwareService } from '../common/services/tenant-aware.service';

@Injectable({ scope: Scope.REQUEST })
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryService: CategoryService,
    private readonly userService: UsersService,
    private readonly dataSource: DataSource,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  /**
   * Normaliza el nombre del producto: MAYÚSCULAS + sin tildes/acentos
   */
  private normalizeName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  }

  async create(
    createProductDto: CreateProductDto,
    createdById: string,
  ): Promise<Product> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Normalizar nombre: MAYÚSCULAS sin acentos
    createProductDto.name = this.normalizeName(createProductDto.name);

    // Verificar si el SKU ya existe en la organización actual
    const repository = this.dataSource.getRepository(Product);
    const existingSku = await this.tenantAwareService.findOneWithTenant(
      repository,
      { where: { sku: createProductDto.sku } },
    );

    if (existingSku) {
      throw new ConflictException('El SKU ya existe en esta organización');
    }

    // ✅ VALIDACIÓN: Verificar si el nombre ya existe en la organización actual
    const existingName = await this.tenantAwareService.findOneWithTenant(
      repository,
      { where: { name: createProductDto.name } },
    );

    if (existingName) {
      throw new ConflictException(
        `Ya existe un producto con el nombre '${createProductDto.name}' en esta organización`,
      );
    }

    // ✅ VALIDACIÓN: Verificar si el código de barras ya existe (si se proporcionó)
    if (createProductDto.barcode) {
      const existingBarcode = await this.tenantAwareService.findOneWithTenant(
        repository,
        { where: { barcode: createProductDto.barcode } },
      );

      if (existingBarcode) {
        throw new ConflictException(
          `Ya existe un producto con el código de barras '${createProductDto.barcode}' en esta organización`,
        );
      }
    }

    // Verificar que la categoría existe, está activa y pertenece a la organización actual
    const category = await this.categoryService.findOne(
      createProductDto.categoryId,
    );
    if (!category || category.status === 'inactive') {
      throw new NotFoundException('Categoría no encontrada o inactiva');
    }

    // Verificar que la categoría pertenece a la misma organización
    if (category.organizationId !== tenantId) {
      throw new BadRequestException(
        'La categoría no pertenece a su organización',
      );
    }

    // Verificar que el usuario creador existe
    const createdBy = await this.userService.findOne(createdById);
    if (!createdBy) {
      throw new NotFoundException('Usuario creador no encontrado');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { prices, categoryId, ...productData } = createProductDto;

      // ✅ CORREGIDO: Usar los nombres correctos de las propiedades
      const product = this.productRepository.create({
        ...productData,
        categoryId: categoryId, // ✅ Usa categoryId directamente
        category: category,
        createdById: createdById, // ✅ Usa createdById directamente
        createdBy: createdBy,
        organizationId: tenantId, // ✅ AGREGADO: organization_id del tenant
      });

      // ✅ CORREGIDO: Guardar producto individual, no como array
      const savedProduct = await queryRunner.manager.save(Product, product);

      // Crear y guardar precios asociados al producto
      if (prices && prices.length > 0) {
        const productPrices = prices.map((priceDto) => {
          const productPrice = new ProductPrice();
          Object.assign(productPrice, priceDto);
          productPrice.status = PriceStatus.ACTIVE;
          // ✅ CORREGIDO: Asignar el producto individual
          productPrice.product = savedProduct;
          return productPrice;
        });
        await queryRunner.manager.save(ProductPrice, productPrices);
      }

      // 🚀 NUEVA FUNCIONALIDAD: Crear lote inicial si tiene stock
      if (createProductDto.stock && createProductDto.stock > 0) {
        try {
          // Obtener el producto completo con precios para determinar costo
          const fullProduct = await queryRunner.manager.findOne(Product, {
            where: { id: savedProduct.id },
            relations: ['prices'],
          });

          // Determinar costo unitario usando la función del InventoryService
          const inventoryService =
            new (require('../inventory/services/inventory.service').InventoryService)(
              queryRunner.manager.getRepository(
                require('../inventory/entities/inventory-movement.entity')
                  .InventoryMovement,
              ),
              queryRunner.manager.getRepository(
                require('../inventory/entities/inventory-batch.entity')
                  .InventoryBatch,
              ),
              queryRunner.manager.getRepository(
                require('../inventory/entities/inventory-batch-movement.entity')
                  .InventoryBatchMovement,
              ),
              queryRunner.manager.getRepository(Product),
              this.dataSource,
            );

          // Determinar precio de costo
          let unitCost = 1000; // Valor por defecto
          if (fullProduct.prices && fullProduct.prices.length > 0) {
            const costPrice = fullProduct.prices.find(
              (p) => p.type === 'cost' && p.status === 'active',
            );
            if (costPrice) {
              unitCost = parseFloat(costPrice.amount.toString());
            } else {
              const salePrice = fullProduct.prices.find(
                (p) => p.type === 'price1' && p.status === 'active',
              );
              if (salePrice) {
                unitCost = parseFloat(salePrice.amount.toString()) * 0.7; // 70% del precio de venta
              }
            }
          }

          // Obtener el almacén principal de la organización
          const mainWarehouse = await queryRunner.manager
            .createQueryBuilder()
            .select('warehouse')
            .from('warehouses', 'warehouse')
            .where('warehouse.organizationId = :orgId', { orgId: tenantId })
            .andWhere('warehouse.isActive = :isActive', { isActive: true })
            .andWhere('warehouse.isMainWarehouse = :isMain', { isMain: true })
            .getRawOne();

          if (!mainWarehouse) {
            console.warn(
              `⚠️ No se encontró almacén principal para la organización ${tenantId}. El stock inicial no se creará.`,
            );
            throw new Error(
              'No se puede crear stock inicial sin un almacén principal configurado',
            );
          }

          const warehouseId = mainWarehouse.warehouse_id;

          // Crear lote inicial usando el queryRunner existente
          const batchNumber = await this.generateBatchNumber(
            tenantId,
            queryRunner,
          );

          const initialBatch = queryRunner.manager.create(
            require('../inventory/entities/inventory-batch.entity')
              .InventoryBatch,
            {
              batchNumber,
              productId: savedProduct.id,
              organizationId: tenantId,
              warehouseId: warehouseId, // Almacén principal
              purchaseDate: new Date(),
              // Campos legacy (requeridos por la BD)
              quantity: createProductDto.stock,
              remainingQuantity: createProductDto.stock,
              // Campos nuevos
              originalQuantity: createProductDto.stock,
              currentQuantity: createProductDto.stock,
              reservedQuantity: 0,
              unitCost,
              totalCost: createProductDto.stock * unitCost,
              remainingValue: createProductDto.stock * unitCost,
              status: 'active',
              metadata: {
                source: 'initial_stock',
                createdWithProduct: true,
                note: 'Stock inicial creado junto con el producto',
              },
            },
          );

          const savedBatch = (await queryRunner.manager.save(
            initialBatch,
          )) as any;

          // Crear movimiento de inventario
          const movementNumber = await this.generateMovementNumber(
            tenantId,
            queryRunner,
          );

          const initialMovement = queryRunner.manager.create(
            require('../inventory/entities/inventory-movement.entity')
              .InventoryMovement,
            {
              movementNumber,
              type: 'initial_stock',
              status: 'confirmed',
              productId: savedProduct.id,
              organizationId: tenantId,
              warehouseId: warehouseId, // Almacén principal
              performedById: createdById, // Usuario que crea el producto
              movementDate: new Date(),
              quantity: createProductDto.stock,
              unitCost,
              totalCost: createProductDto.stock * unitCost,
              stockAfter: createProductDto.stock,
              stockValueAfter: createProductDto.stock * unitCost,
              referenceType: 'initial_stock',
              notes: 'Stock inicial del producto',
              metadata: {
                batchId: savedBatch.id,
                source: 'product_creation',
              },
            },
          );

          const savedMovement = (await queryRunner.manager.save(
            initialMovement,
          )) as any;

          // Crear relación batch-movement
          const batchMovement = queryRunner.manager.create(
            require('../inventory/entities/inventory-batch-movement.entity')
              .InventoryBatchMovement,
            {
              type: 'consume',
              batchId: savedBatch.id,
              movementId: savedMovement.id,
              organizationId: tenantId,
              quantity: createProductDto.stock,
              unitCost,
              totalCost: createProductDto.stock * unitCost,
              batchQuantityAfter: savedBatch.currentQuantity,
              batchValueAfter: savedBatch.remainingValue,
            },
          );

          await queryRunner.manager.save(batchMovement);
        } catch (stockError) {
          console.error(
            `⚠️ Error creando stock inicial (producto creado exitosamente):`,
            stockError,
          );
          // No fallar la creación del producto, solo loggear el error
        }
      }

      await queryRunner.commitTransaction();

      // ✅ CORREGIDO: Usar savedProduct.id (no savedProduct como array)
      return this.productRepository.findOne({
        where: { id: savedProduct.id },
        relations: ['prices', 'category', 'createdBy'],
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Error durante la creación del producto:', err);

      // Proporcionar error más específico
      if (err.code === '23505') {
        // Violación de constraint única
        throw new ConflictException(
          `El SKU '${createProductDto.sku}' ya existe en esta organización`,
        );
      } else if (err.code === '23502') {
        // Violación de constraint NOT NULL
        throw new BadRequestException(
          `Campo requerido faltante: ${err.column}`,
        );
      } else if (err.code === '23503') {
        // Violación de foreign key
        throw new BadRequestException(
          'Referencia inválida en los datos del producto',
        );
      } else {
        throw new BadRequestException(
          `Error al crear producto: ${err.message || 'Error desconocido'}`,
        );
      }
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    query: ProductQueryDto,
  ): Promise<PaginatedResponseDto<Product>> {
    return this.productRepository.findAllPaginated(query);
  }

  async findOne(id: string): Promise<Product> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const product = await this.productRepository.findOne({
      where: { id, organizationId: tenantId },
      relations: ['category', 'prices', 'createdBy'],
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.productRepository.findBySku(sku);
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async findByBarcode(barcode: string): Promise<Product> {
    const product = await this.productRepository.findByBarcode(barcode);
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  // async update(
  //   id: string,
  //   updateProductDto: UpdateProductDto,
  // ): Promise<Product> {
  //   const product = await this.findOne(id);

  //   // Verificar SKU único si se está actualizando
  //   if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
  //     const existingSku = await this.productRepository.findBySku(
  //       updateProductDto.sku,
  //     );
  //     if (existingSku) {
  //       throw new ConflictException('El SKU ya está en uso');
  //     }
  //   }

  //   // Verificar código de barras único si se está actualizando
  //   if (
  //     updateProductDto.barcode &&
  //     updateProductDto.barcode !== product.barcode
  //   ) {
  //     const existingBarcode = await this.productRepository.findByBarcode(
  //       updateProductDto.barcode,
  //     );
  //     if (existingBarcode) {
  //       throw new ConflictException('El código de barras ya está en uso');
  //     }
  //   }

  //   // Verificar categoría si se está actualizando
  //   if (updateProductDto.categoryId) {
  //     await this.categoryService.findOne(updateProductDto.categoryId);
  //   }

  //   // Si se incluyen precios, usar transacción para actualizar
  //   if (updateProductDto.prices && updateProductDto.prices.length > 0) {
  //     const queryRunner = this.dataSource.createQueryRunner();
  //     await queryRunner.connect();
  //     await queryRunner.startTransaction();

  //     try {
  //       // Separar precios y datos del producto
  //       const { prices, ...productData } = updateProductDto;

  //       // Actualizar datos básicos del producto
  //       Object.assign(product, productData);
  //       const updatedProduct = await queryRunner.manager.save(Product, product);

  //       // Obtener precios actuales del producto
  //       const currentPrices = await queryRunner.manager.find(ProductPrice, {
  //         where: { productId: id },
  //       });

  //       // Procesar cada precio en el array de actualización
  //       for (const priceDto of prices) {
  //         if (priceDto.id) {
  //           // Actualizar precio existente
  //           const existingPrice = currentPrices.find(p => p.id === priceDto.id);
  //           if (existingPrice) {
  //             Object.assign(existingPrice, priceDto);
  //             await queryRunner.manager.save(ProductPrice, existingPrice);
  //           }
  //         } else {
  //           // Crear nuevo precio
  //           const newPrice = new ProductPrice();
  //           Object.assign(newPrice, priceDto);
  //           newPrice.status = PriceStatus.ACTIVE;
  //           newPrice.product = updatedProduct;
  //           newPrice.productId = updatedProduct.id;
  //           await queryRunner.manager.save(ProductPrice, newPrice);
  //         }
  //       }

  //       await queryRunner.commitTransaction();

  //       // Retornar producto actualizado con precios
  //       return this.productRepository.findOne({
  //         where: { id: updatedProduct.id },
  //         relations: ['prices', 'category', 'createdBy'],
  //       });

  //     } catch (err) {
  //       await queryRunner.rollbackTransaction();
  //       console.error('Error durante la actualización del producto:', err);
  //       throw new BadRequestException('Falló la actualización del producto');
  //     } finally {
  //       await queryRunner.release();
  //     }
  //   } else {
  //     // Actualización simple sin precios
  //     Object.assign(product, updateProductDto);
  //     return this.productRepository.save(product);
  //   }
  // }

  // En tu products.service.ts, reemplaza el método update con este:

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Normalizar nombre: MAYÚSCULAS sin acentos
    if (updateProductDto.name) {
      updateProductDto.name = this.normalizeName(updateProductDto.name);
    }

    // Verificar SKU único si se está actualizando
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existingSku = await this.productRepository.findBySku(
        updateProductDto.sku,
      );
      if (existingSku) {
        throw new ConflictException('El SKU ya está en uso');
      }
    }

    // ✅ VALIDACIÓN: Verificar nombre único si se está actualizando
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      const repository = this.dataSource.getRepository(Product);
      const existingName = await this.tenantAwareService.findOneWithTenant(
        repository,
        { where: { name: updateProductDto.name } },
      );
      if (existingName && existingName.id !== product.id) {
        throw new ConflictException(
          `Ya existe un producto con el nombre '${updateProductDto.name}' en esta organización`,
        );
      }
    }

    // ✅ VALIDACIÓN: Verificar SKU único si se está actualizando
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const repository = this.dataSource.getRepository(Product);
      const existingSku = await this.tenantAwareService.findOneWithTenant(
        repository,
        { where: { sku: updateProductDto.sku } },
      );
      if (existingSku && existingSku.id !== product.id) {
        throw new ConflictException(
          `Ya existe un producto con el SKU '${updateProductDto.sku}' en esta organización`,
        );
      }
    }

    // ✅ VALIDACIÓN: Verificar código de barras único si se está actualizando
    if (
      updateProductDto.barcode &&
      updateProductDto.barcode !== product.barcode
    ) {
      const repository = this.dataSource.getRepository(Product);
      const existingBarcode = await this.tenantAwareService.findOneWithTenant(
        repository,
        { where: { barcode: updateProductDto.barcode } },
      );
      if (existingBarcode && existingBarcode.id !== product.id) {
        throw new ConflictException(
          `Ya existe un producto con el código de barras '${updateProductDto.barcode}' en esta organización`,
        );
      }
    }

    // Verificar categoría si se está actualizando
    if (updateProductDto.categoryId) {
      const tenantId = this.tenantAwareService.getTenantId();
      if (!tenantId) {
        throw new BadRequestException('No se pudo determinar la organización');
      }

      const category = await this.categoryService.findOne(
        updateProductDto.categoryId,
      );
      if (category.organizationId !== tenantId) {
        throw new BadRequestException(
          'La categoría no pertenece a su organización',
        );
      }
    }

    // ✅ CORRECCIÓN PRINCIPAL: Manejo mejorado de precios
    if (updateProductDto.prices && updateProductDto.prices.length > 0) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {

        // Separar precios y datos del producto
        const { prices, ...productData } = updateProductDto;

        // Actualizar datos básicos del producto
        Object.assign(product, productData);
        const updatedProduct = await queryRunner.manager.save(Product, product);

        // Obtener precios actuales del producto
        const currentPrices = await queryRunner.manager.find(ProductPrice, {
          where: { product: { id } },
        });


        // Procesar cada precio en el array de actualización
        for (const priceDto of prices) {
          if (priceDto.id) {
            // ✅ ACTUALIZAR PRECIO EXISTENTE
            const existingPrice = currentPrices.find(
              (p) => p.id === priceDto.id,
            );
            if (existingPrice) {
              // Actualizar campos
              existingPrice.type = priceDto.type as PriceType;
              existingPrice.amount = priceDto.amount;
              existingPrice.name = priceDto.name || existingPrice.name;
              existingPrice.currency =
                priceDto.currency || existingPrice.currency;
              existingPrice.discountPercentage =
                priceDto.discountPercentage || 0;
              existingPrice.discountAmount = priceDto.discountAmount || null;
              existingPrice.minQuantity = priceDto.minQuantity || 1;
              existingPrice.notes = priceDto.notes || existingPrice.notes;
              existingPrice.status = priceDto.status || PriceStatus.ACTIVE;
              existingPrice.updatedAt = new Date();

              await queryRunner.manager.save(ProductPrice, existingPrice);
            }
          } else {
            // ✅ CREAR NUEVO PRECIO

            // Verificar si ya existe un precio del mismo tipo
            const existingTypePrice = currentPrices.find(
              (p) =>
                p.type === priceDto.type && p.status === PriceStatus.ACTIVE,
            );

            if (existingTypePrice) {
              // Actualizar el precio existente del mismo tipo
              existingTypePrice.amount = priceDto.amount;
              existingTypePrice.name = priceDto.name || existingTypePrice.name;
              existingTypePrice.currency =
                priceDto.currency || existingTypePrice.currency;
              existingTypePrice.discountPercentage =
                priceDto.discountPercentage || 0;
              existingTypePrice.discountAmount =
                priceDto.discountAmount || null;
              existingTypePrice.minQuantity = priceDto.minQuantity || 1;
              existingTypePrice.notes =
                priceDto.notes || existingTypePrice.notes;
              existingTypePrice.updatedAt = new Date();

              await queryRunner.manager.save(ProductPrice, existingTypePrice);
            } else {
              // Crear completamente nuevo
              const newPrice = new ProductPrice();
              newPrice.type = priceDto.type as PriceType;
              newPrice.amount = priceDto.amount;
              newPrice.name = priceDto.name || `Precio ${priceDto.type}`;
              newPrice.currency = priceDto.currency || 'COP';
              newPrice.status = priceDto.status || PriceStatus.ACTIVE;
              newPrice.discountPercentage = priceDto.discountPercentage || 0;
              newPrice.discountAmount = priceDto.discountAmount || null;
              newPrice.minQuantity = priceDto.minQuantity || 1;
              newPrice.notes = priceDto.notes || null;
              newPrice.product = updatedProduct;
              newPrice.createdAt = new Date();
              newPrice.updatedAt = new Date();

              await queryRunner.manager.save(ProductPrice, newPrice);
            }
          }
        }

        await queryRunner.commitTransaction();

        // Retornar producto actualizado con precios
        const finalProduct = await this.productRepository.findOne({
          where: { id: updatedProduct.id },
          relations: ['prices', 'category', 'createdBy'],
        });

        return finalProduct;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        console.error(
          '❌ ProductService: Error durante la actualización:',
          err,
        );
        throw new BadRequestException(
          `Falló la actualización del producto: ${err.message}`,
        );
      } finally {
        await queryRunner.release();
      }
    } else {
      // ✅ ACTUALIZACIÓN SIMPLE SIN PRECIOS
      Object.assign(product, updateProductDto);
      const savedProduct = await this.productRepository.save(product);

      // Retornar con relaciones
      return this.productRepository.findOne({
        where: { id: savedProduct.id },
        relations: ['prices', 'category', 'createdBy'],
      });
    }
  }

  async updateStock(
    id: string,
    quantity: number,
    operation: 'add' | 'subtract' = 'subtract',
  ): Promise<Product> {
    const product = await this.findOne(id);

    if (operation === 'subtract' && product.stock < quantity) {
      throw new BadRequestException('Stock insuficiente');
    }

    await this.productRepository.updateStock(id, quantity, operation);
    return this.findOne(id);
  }

  async updateStatus(id: string, status: ProductStatus): Promise<Product> {
    const product = await this.findOne(id);
    product.status = status;
    return this.productRepository.save(product);
  }

  async findLowStockProducts(): Promise<Product[]> {
    return this.productRepository.findLowStockProducts();
  }

  async findOutOfStockProducts(): Promise<Product[]> {
    return this.productRepository.findOutOfStockProducts();
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    // Verificar que la categoría existe
    await this.categoryService.findOne(categoryId);
    return this.productRepository.getProductsByCategory(categoryId);
  }

  async softDelete(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.softRemove(product);
  }

  async restore(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    await this.productRepository.restore(id);
    return this.findOne(id);
  }

  async getStats(): Promise<any> {

    try {
      const stats = await this.productRepository.getProductStats();

      // Calcular porcentaje activo de forma segura
      const activePercentage =
        stats.total > 0
          ? Number(((stats.active / stats.total) * 100).toFixed(2))
          : 0;

      const result = {
        ...stats,
        activePercentage,
        // Asegurar que todas las propiedades estén presentes
        total: stats.total || 0,
        active: stats.active || 0,
        inactive: stats.inactive || 0,
        outOfStock: stats.outOfStock || 0,
        lowStock: stats.lowStock || 0,
      };

      return result;
    } catch (error) {
      console.error('❌ ProductService: Error al obtener estadísticas:', error);

      // Retornar estadísticas por defecto en caso de error
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
        activePercentage: 0,
      };
    }
  }

  async searchProducts(term: string, limit: number = 10): Promise<Product[]> {
    return this.productRepository.searchProducts(term, limit);
  }

  // Métodos adicionales útiles para tu sistema de facturación
  async findBySkuOrBarcode(code: string): Promise<Product> {
    const product = await this.productRepository.findBySkuOrBarcode(code);
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async validateStockForSale(
    productId: string,
    quantity: number,
  ): Promise<boolean> {
    const product = await this.findOne(productId);
    return product.stock >= quantity && product.status === ProductStatus.ACTIVE;
  }

  async getProductWithPrice(
    productId: string,
    priceType: PriceType = PriceType.PRICE1,
  ): Promise<Product> {
    const product = await this.findOne(productId);

    // Verificar que el producto tiene el tipo de precio solicitado
    const price = product.getPriceByType(priceType);
    if (!price) {
      throw new NotFoundException(
        `Producto no tiene precio del tipo ${priceType}`,
      );
    }

    return product;
  }

  async reduceStockForSale(productId: string, quantity: number): Promise<void> {
    const isValid = await this.validateStockForSale(productId, quantity);
    if (!isValid) {
      throw new BadRequestException('Stock insuficiente o producto inactivo');
    }

    await this.productRepository.updateStock(productId, quantity, 'subtract');
  }

  async getInventoryValue(): Promise<number> {
    return this.productRepository.getStockValue();
  }

  /**
   * Generar número de lote único
   */
  private async generateBatchNumber(
    organizationId: string,
    queryRunner: any,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `BATCH-${year}${month}-`;

    const existingBatches = await queryRunner.manager
      .createQueryBuilder('InventoryBatch', 'batch')
      .select('batch.batchNumber')
      .where('batch.organizationId = :organizationId', { organizationId })
      .andWhere('batch.batchNumber LIKE :pattern', { pattern: `${prefix}%` })
      .orderBy('batch.batchNumber', 'DESC')
      .getMany();

    let maxSequence = 0;
    for (const batch of existingBatches) {
      const sequencePart = batch.batchNumber.substring(prefix.length);
      const sequenceNumber = parseInt(sequencePart);
      if (!isNaN(sequenceNumber) && sequenceNumber > maxSequence) {
        maxSequence = sequenceNumber;
      }
    }

    const nextSequence = maxSequence + 1;
    const sequence = String(nextSequence).padStart(6, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generar número de movimiento único
   */
  private async generateMovementNumber(
    organizationId: string,
    queryRunner: any,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `MOV-${year}${month}-`;

    const existingMovements = await queryRunner.manager
      .createQueryBuilder('InventoryMovement', 'movement')
      .select('movement.movementNumber')
      .where('movement.organizationId = :organizationId', { organizationId })
      .andWhere('movement.movementNumber LIKE :pattern', {
        pattern: `${prefix}%`,
      })
      .orderBy('movement.movementNumber', 'DESC')
      .getMany();

    let maxSequence = 0;
    for (const movement of existingMovements) {
      const sequencePart = movement.movementNumber.substring(prefix.length);
      const sequenceNumber = parseInt(sequencePart);
      if (!isNaN(sequenceNumber) && sequenceNumber > maxSequence) {
        maxSequence = sequenceNumber;
      }
    }

    const nextSequence = maxSequence + 1;
    const sequence = String(nextSequence).padStart(6, '0');
    return `${prefix}${sequence}`;
  }
}
