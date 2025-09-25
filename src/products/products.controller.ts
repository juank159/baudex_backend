import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  UseGuards,
  Req,
  Put,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductStatus } from './entities/product.entity';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  TenantId,
  CurrentOrganization,
} from '../common/decorators/current-tenant.decorator';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { SubscriptionService } from '../subscriptions/services/subscription.service';

@ApiTags('Productos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  @ApiOperation({ summary: 'Crear nuevo producto' })
  @ApiResponse({
    status: 201,
    description: 'Producto creado exitosamente',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 409, description: 'SKU ya existe' })
  @ApiResponse({
    status: 403,
    description: 'Suscripción requerida para crear productos',
  })
  async create(
    @Body() createProductDto: CreateProductDto,
    @GetUser() user: User,
    @TenantId() tenantId: string,
    @CurrentOrganization() organization: Organization,
  ): Promise<ProductResponseDto> {
    console.log(
      `🏢 Creating product for organization: ${organization?.name} (${tenantId})`,
    );

    // 🔒 VALIDACIÓN DE SUSCRIPCIÓN CRÍTICA
    const canCreateProduct = await this.subscriptionService.canPerformAction(
      tenantId,
      'create_product',
    );

    if (!canCreateProduct) {
      throw new ForbiddenException(
        'Su suscripción ha expirado. Por favor, actualice su plan para continuar creando productos.',
      );
    }

    const product = await this.productService.create(createProductDto, user.id);

    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  @Get('debug/low-stock')
  async debugLowStock() {
    const products = await this.productService.findLowStockProducts();
    const stats = await this.productService.getStats();

    console.log('🔍 DEBUG Low Stock:');
    console.log('📊 Stats lowStock count:', stats.lowStock);
    console.log('📋 Actual products found:', products.length);
    products.forEach((p) => {
      console.log(
        `   - ${p.name}: stock=${p.stock}, minStock=${p.minStock}, isLow=${p.stock <= p.minStock}`,
      );
    });

    return {
      statsCount: stats.lowStock,
      actualProducts: products.length,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        status: p.status,
      })),
    };
  }

  // ✅ SIN INTERCEPTOR - maneja la estructura paginada manualmente
  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    const result = await this.productService.findAll(query);

    // ✅ Transformar solo los productos dentro de data, mantener la estructura de paginación
    if (result && result.data && Array.isArray(result.data)) {
      return {
        success: true,
        data: result.data.map((product) =>
          plainToInstance(ProductResponseDto, product, {
            excludeExtraneousValues: true,
          }),
        ),
        meta: result.meta,
        timestamp: new Date().toISOString(),
      };
    }

    // Si por alguna razón no tiene la estructura esperada, devolver tal como está
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ CON INTERCEPTOR - devuelve array de ProductResponseDto
  @Get('search')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async search(
    @Query('term') term: string,
    @Query('limit') limit: number = 10,
  ): Promise<ProductResponseDto[]> {
    const products = await this.productService.searchProducts(term, limit);
    return plainToInstance(ProductResponseDto, products, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve array de ProductResponseDto
  @Get('low-stock')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async findLowStock(): Promise<ProductResponseDto[]> {
    const products = await this.productService.findLowStockProducts();
    return plainToInstance(ProductResponseDto, products, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve array de ProductResponseDto
  @Get('out-of-stock')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async findOutOfStock(): Promise<ProductResponseDto[]> {
    const products = await this.productService.findOutOfStockProducts();
    return plainToInstance(ProductResponseDto, products, {
      excludeExtraneousValues: true,
    });
  }

  @Get('stats')
  async getStats() {
    console.log('🔧 ProductController: Obteniendo estadísticas...');

    try {
      const stats = await this.productService.getStats();
      console.log(
        '📊 ProductController: Estadísticas recibidas del service:',
        stats,
      );

      // ✅ CORRECCIÓN: Devolver directamente los datos SIN wrapping adicional
      // porque el interceptor ya no está aplicado a este método
      const response = {
        success: true,
        data: stats, // ← Los datos van directamente aquí
        timestamp: new Date().toISOString(),
      };

      console.log('✅ ProductController: Respuesta final:', response);
      return response;
    } catch (error) {
      console.error(
        '❌ ProductController: Error al obtener estadísticas:',
        error,
      );

      // Respuesta de error consistente
      return {
        success: false,
        data: null,
        error: {
          message: 'Error al obtener estadísticas',
          details: error.message,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ✅ CON INTERCEPTOR - devuelve array de ProductResponseDto
  @Get('category/:categoryId')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async findByCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<ProductResponseDto[]> {
    const products =
      await this.productService.getProductsByCategory(categoryId);
    return plainToInstance(ProductResponseDto, products, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve ProductResponseDto individual
  @Get('sku/:sku')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async findBySku(@Param('sku') sku: string): Promise<ProductResponseDto> {
    const product = await this.productService.findBySku(sku);
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve ProductResponseDto individual
  @Get('barcode/:barcode')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async findByBarcode(
    @Param('barcode') barcode: string,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.findByBarcode(barcode);
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve ProductResponseDto individual
  @Get(':id')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.findOne(id);
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  @ApiResponse({
    status: 403,
    description: 'Suscripción requerida para actualizar productos',
  })
  async updateComplete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @TenantId() tenantId: string,
  ): Promise<ProductResponseDto> {
    // 🔒 VALIDACIÓN DE SUSCRIPCIÓN CRÍTICA
    const canUpdateProduct = await this.subscriptionService.canPerformAction(
      tenantId,
      'update_product',
    );

    if (!canUpdateProduct) {
      throw new ForbiddenException(
        'Su suscripción ha expirado. Por favor, actualice su plan para continuar editando productos.',
      );
    }
    console.log(
      '🔧 ProductController: PUT request recibido para producto:',
      id,
    );
    console.log(
      '📋 Datos recibidos:',
      JSON.stringify(updateProductDto, null, 2),
    );

    // Verificar si se incluyen precios en la petición
    if (updateProductDto.prices && updateProductDto.prices.length > 0) {
      console.log(
        '🏷️ Precios incluidos en PUT:',
        updateProductDto.prices.length,
      );
      updateProductDto.prices.forEach((price, index) => {
        console.log(
          `   Precio ${index}: ${price.type} - $${price.amount} (ID: ${price.id || 'NUEVO'})`,
        );
      });
    } else {
      console.log('⚠️ No se incluyen precios en la petición PUT');
    }

    const product = await this.productService.update(id, updateProductDto);

    // Verificar la respuesta
    if (product.prices && product.prices.length > 0) {
      console.log(
        '✅ Producto actualizado con precios:',
        product.prices.length,
      );
      product.prices.forEach((price, index) => {
        console.log(
          `   Precio actualizado ${index}: ${price.type} - $${price.amount} (ID: ${price.id})`,
        );
      });
    } else {
      console.log('⚠️ Producto actualizado SIN precios en la respuesta');
    }

    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve ProductResponseDto individual
  @Patch(':id')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.update(id, updateProductDto);
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve ProductResponseDto individual
  @Patch(':id/status')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ProductStatus,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.updateStatus(id, status);
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ CON INTERCEPTOR - devuelve ProductResponseDto individual
  @Patch(':id/stock')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async updateStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { quantity: number; operation: 'add' | 'subtract' },
  ): Promise<ProductResponseDto> {
    const product = await this.productService.updateStock(
      id,
      body.quantity,
      body.operation,
    );
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ SIN INTERCEPTOR - devuelve void
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({
    status: 403,
    description: 'Suscripción requerida para eliminar productos',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<void> {
    // 🔒 VALIDACIÓN DE SUSCRIPCIÓN CRÍTICA
    const canDeleteProduct = await this.subscriptionService.canPerformAction(
      tenantId,
      'delete_product',
    );

    if (!canDeleteProduct) {
      throw new ForbiddenException(
        'Su suscripción ha expirado. Por favor, actualice su plan para continuar eliminando productos.',
      );
    }

    return this.productService.softDelete(id);
  }

  // ✅ CON INTERCEPTOR - devuelve ProductResponseDto individual
  @Post(':id/restore')
  @UseInterceptors(new TransformInterceptor(ProductResponseDto))
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.restore(id);
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }
}
