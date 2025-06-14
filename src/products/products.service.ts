// src/modules/products/products.service.ts - CORREGIDO
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
      throw new ConflictException('El SKU ya está en uso');
    }

    // Verificar si el código de barras ya existe (si se proporciona)
    if (createProductDto.barcode) {
      const existingBarcode = await this.productRepository.findByBarcode(
        createProductDto.barcode,
      );
      if (existingBarcode) {
        throw new ConflictException('El código de barras ya está en uso');
      }
    }

    // Verificar que la categoría existe
    await this.categoryService.findOne(createProductDto.categoryId);

    // Verificar que el usuario existe
    await this.userService.findOne(createdById);

    // Usar transacción para crear producto y precios
    return this.dataSource.transaction(async (manager) => {
      const { prices, ...productData } = createProductDto;

      const product = manager.create(Product, {
        ...productData,
        createdById,
      });

      const savedProduct = await manager.save(product);

      // Crear precios - CORREGIDO
      if (prices && prices.length > 0) {
        const productPrices = prices.map((priceDto) =>
          manager.create(ProductPrice, {
            type: priceDto.type as PriceType, // Cast explícito al enum
            name: priceDto.name,
            amount: priceDto.amount,
            currency: priceDto.currency || 'COP',
            status: PriceStatus.ACTIVE, // Valor por defecto
            discountPercentage: priceDto.discountPercentage || 0,
            discountAmount: priceDto.discountAmount,
            minQuantity: priceDto.minQuantity || 1,
            notes: priceDto.notes,
            productId: savedProduct.id, // Usar productId según tu entidad
          }),
        );

        await manager.save(ProductPrice, productPrices);
      }

      return this.findOne(savedProduct.id);
    });
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
    const stats = await this.productRepository.getProductStats();
    return {
      ...stats,
      activePercentage:
        stats.total > 0
          ? Number(((stats.active / stats.total) * 100).toFixed(2))
          : 0,
    };
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
