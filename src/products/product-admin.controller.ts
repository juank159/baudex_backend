import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductService } from './products.service';
import { SkuService } from 'src/common/services/sku.service';

@Controller('admin/products')
export class ProductAdminController {
  constructor(
    private readonly productService: ProductService,
    private readonly skuService: SkuService,
  ) {}

  @Post('generate-sku')
  async generateSku(
    @Body()
    body: {
      categoryCode: string;
      productName: string;
      increment?: number;
    },
  ): Promise<{ sku: string }> {
    const sku = this.skuService.generateSku(
      body.categoryCode,
      body.productName,
      body.increment,
    );
    return { sku };
  }

  @Post('validate-sku')
  async validateSku(@Body('sku') sku: string): Promise<{ valid: boolean }> {
    const valid = this.skuService.validateSku(sku);
    return { valid };
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadImages(
    @Body('productId') productId: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB por imagen
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    // TODO: Implementar subida de archivos
    // const urls = await Promise.all(
    //   files.map(file => this.fileUploadService.uploadFile(file, 'products'))
    // );
    // await this.productService.update(productId, { images: urls });
    throw new Error('File upload implementation pending');
  }

  @Get('export')
  async exportProducts(): Promise<any> {
    // TODO: Implementar exportación a CSV/Excel
    throw new Error('Export functionality to be implemented');
  }

  @Post('import')
  async importProducts(): Promise<any> {
    // TODO: Implementar importación desde CSV/Excel
    throw new Error('Import functionality to be implemented');
  }
}
