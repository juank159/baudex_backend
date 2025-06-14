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
} from '@nestjs/common';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductStatus } from './entities/product.entity';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Controller('products')
@UseInterceptors(new TransformInterceptor(ProductResponseDto))
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User, // TODO: Implementar después de auth
  ): Promise<ProductResponseDto> {
    // Temporal: usar un ID fijo hasta implementar autenticación
    const tempUserId = '00000000-0000-0000-0000-000000000001';
    return this.productService.create(createProductDto, tempUserId);
  }

  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    return this.productService.findAll(query);
  }

  @Get('search')
  async search(
    @Query('term') term: string,
    @Query('limit') limit: number = 10,
  ): Promise<ProductResponseDto[]> {
    return this.productService.searchProducts(term, limit);
  }

  @Get('low-stock')
  async findLowStock(): Promise<ProductResponseDto[]> {
    return this.productService.findLowStockProducts();
  }

  @Get('out-of-stock')
  async findOutOfStock(): Promise<ProductResponseDto[]> {
    return this.productService.findOutOfStockProducts();
  }

  @Get('stats')
  async getStats() {
    return this.productService.getStats();
  }

  @Get('category/:categoryId')
  async findByCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<ProductResponseDto[]> {
    return this.productService.getProductsByCategory(categoryId);
  }

  @Get('sku/:sku')
  async findBySku(@Param('sku') sku: string): Promise<ProductResponseDto> {
    return this.productService.findBySku(sku);
  }

  @Get('barcode/:barcode')
  async findByBarcode(
    @Param('barcode') barcode: string,
  ): Promise<ProductResponseDto> {
    return this.productService.findByBarcode(barcode);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productService.update(id, updateProductDto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ProductStatus,
  ): Promise<ProductResponseDto> {
    return this.productService.updateStatus(id, status);
  }

  @Patch(':id/stock')
  async updateStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { quantity: number; operation: 'add' | 'subtract' },
  ): Promise<ProductResponseDto> {
    return this.productService.updateStock(id, body.quantity, body.operation);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productService.softDelete(id);
  }

  @Post(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.productService.restore(id);
  }
}
