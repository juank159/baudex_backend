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
import { ProductPresentationService } from './product-presentation.service';
import { CreateProductPresentationDto } from './dto/create-product-presentation.dto';
import { UpdateProductPresentationDto } from './dto/update-product-presentation.dto';
import { ProductPresentationResponseDto } from './dto/product-presentation-response.dto';

@Controller('products/:productId/presentations')
@UseInterceptors(new TransformInterceptor(ProductPresentationResponseDto))
export class ProductPresentationController {
  constructor(
    private readonly presentationService: ProductPresentationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductPresentationDto,
  ): Promise<ProductPresentationResponseDto> {
    return this.presentationService.create(productId, dto) as any;
  }

  @Get()
  async findAll(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductPresentationResponseDto[]> {
    return this.presentationService.findAll(productId) as any;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductPresentationResponseDto> {
    return this.presentationService.findOne(id) as any;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductPresentationDto,
  ): Promise<ProductPresentationResponseDto> {
    return this.presentationService.update(id, dto) as any;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.presentationService.softDelete(id);
  }

  @Post(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductPresentationResponseDto> {
    return this.presentationService.restore(id) as any;
  }
}
