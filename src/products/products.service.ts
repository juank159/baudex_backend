import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryService: CategoryService,
    private readonly userService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    createdById: string,
  ): Promise<Product> {
    // Verificar si el SKU ya existe
    const existingSku = await this.productRepository.findBySku(
      createProductDto.sku,
    );
    if (existingSku) {
      throw new ConflictException('El SKU ya existe');
    }

    // Verificar que la categoría existe y está activa
    const category = await this.categoryService.findOne(
      createProductDto.categoryId,
    );
    if (!category || category.status === 'inactive') {
      throw new NotFoundException('Categoría no encontrada o inactiva');
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
          productPrice.productId = savedProduct.id;
          return productPrice;
        });
        await queryRunner.manager.save(ProductPrice, productPrices);
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
      throw new BadRequestException('Falló la creación del producto');
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
    const product = await this.productRepository.findOne({
      where: { id },
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

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Verificar SKU único si se está actualizando
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existingSku = await this.productRepository.findBySku(
        updateProductDto.sku,
      );
      if (existingSku) {
        throw new ConflictException('El SKU ya está en uso');
      }
    }

    // Verificar código de barras único si se está actualizando
    if (
      updateProductDto.barcode &&
      updateProductDto.barcode !== product.barcode
    ) {
      const existingBarcode = await this.productRepository.findByBarcode(
        updateProductDto.barcode,
      );
      if (existingBarcode) {
        throw new ConflictException('El código de barras ya está en uso');
      }
    }

    // Verificar categoría si se está actualizando
    if (updateProductDto.categoryId) {
      await this.categoryService.findOne(updateProductDto.categoryId);
    }

    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
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
    console.log('🔧 ProductService: Obteniendo estadísticas...');

    try {
      const stats = await this.productRepository.getProductStats();
      console.log(
        '📊 ProductService: Estadísticas recibidas del repositorio:',
        stats,
      );

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

      console.log('✅ ProductService: Estadísticas finales:', result);
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
}
