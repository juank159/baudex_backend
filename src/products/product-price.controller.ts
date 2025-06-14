import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { ProductPriceService } from './product-price.service';
import { CreateProductPriceDto } from './dto/create-product-price.dto';
import { ProductPriceResponseDto } from './dto/product-price-response.dto';
import { PriceStatus, PriceType } from './entities/product-price.entity';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';

@Controller('products/:productId/prices')
@UseInterceptors(new TransformInterceptor(ProductPriceResponseDto))
export class ProductPriceController {
  constructor(private readonly productPriceService: ProductPriceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() createPriceDto: CreateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    return this.productPriceService.create(productId, createPriceDto);
  }

  @Get()
  async findAll(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductPriceResponseDto[]> {
    return this.productPriceService.findAll(productId);
  }

  @Get('type/:type')
  async findByType(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('type') type: PriceType,
  ): Promise<ProductPriceResponseDto | null> {
    return this.productPriceService.findByType(productId, type);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductPriceResponseDto> {
    return this.productPriceService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePriceDto: UpdateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    return this.productPriceService.update(id, updatePriceDto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: PriceStatus,
  ): Promise<ProductPriceResponseDto> {
    return this.productPriceService.updateStatus(id, status);
  }

  @Post('bulk-update')
  async bulkUpdate(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() priceUpdates: { type: PriceType; amount: number }[],
  ): Promise<ProductPriceResponseDto[]> {
    return this.productPriceService.bulkUpdatePrices(productId, priceUpdates);
  }

  @Post(':id/calculate-margin')
  async calculateMargin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('costPrice') costPrice: number,
  ): Promise<{ margin: number }> {
    const margin = await this.productPriceService.calculateProfitMargin(
      id,
      costPrice,
    );
    return { margin };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productPriceService.softDelete(id);
  }

  @Post(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductPriceResponseDto> {
    return this.productPriceService.restore(id);
  }
}
