import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { ProductPresentation } from './entities/product-presentation.entity';
import { Product } from './entities/product.entity';
import { CreateProductPresentationDto } from './dto/create-product-presentation.dto';
import { UpdateProductPresentationDto } from './dto/update-product-presentation.dto';

@Injectable()
export class ProductPresentationService {
  private readonly presentationRepository: Repository<ProductPresentation>;
  private readonly productRepository: Repository<Product>;

  constructor(private readonly dataSource: DataSource) {
    this.presentationRepository =
      dataSource.getRepository(ProductPresentation);
    this.productRepository = dataSource.getRepository(Product);
  }

  async create(
    productId: string,
    dto: CreateProductPresentationDto,
  ): Promise<ProductPresentation> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (dto.barcode) {
      await this.assertBarcodeUnique(dto.barcode);
    }

    if (dto.isDefault) {
      await this.unsetExistingDefault(productId);
    }

    const presentation = this.presentationRepository.create({
      ...dto,
      productId,
    });
    return this.presentationRepository.save(presentation);
  }

  async findAll(productId: string): Promise<ProductPresentation[]> {
    return this.presentationRepository.find({
      where: { productId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ProductPresentation> {
    const presentation = await this.presentationRepository.findOne({
      where: { id },
    });
    if (!presentation) {
      throw new NotFoundException('Presentación no encontrada');
    }
    return presentation;
  }

  async update(
    id: string,
    dto: UpdateProductPresentationDto,
  ): Promise<ProductPresentation> {
    const presentation = await this.findOne(id);

    if (dto.barcode && dto.barcode !== presentation.barcode) {
      await this.assertBarcodeUnique(dto.barcode, id);
    }

    if (dto.isDefault === true && !presentation.isDefault) {
      await this.unsetExistingDefault(presentation.productId, id);
    }

    Object.assign(presentation, dto);
    return this.presentationRepository.save(presentation);
  }

  async softDelete(id: string): Promise<void> {
    const presentation = await this.findOne(id);
    if (presentation.isDefault) {
      throw new ConflictException(
        'No puedes eliminar la presentación marcada como default',
      );
    }
    await this.presentationRepository.softRemove(presentation);
  }

  async restore(id: string): Promise<ProductPresentation> {
    const presentation = await this.presentationRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!presentation) {
      throw new NotFoundException('Presentación no encontrada');
    }
    await this.presentationRepository.restore(id);
    return this.findOne(id);
  }

  // Helpers
  private async assertBarcodeUnique(
    barcode: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.presentationRepository.findOne({
      where: { barcode },
    });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(
        `Ya existe una presentación con el código de barras "${barcode}"`,
      );
    }
  }

  private async unsetExistingDefault(
    productId: string,
    ignoreId?: string,
  ): Promise<void> {
    const qb = this.presentationRepository
      .createQueryBuilder()
      .update(ProductPresentation)
      .set({ isDefault: false })
      .where('product_id = :productId', { productId })
      .andWhere('"isDefault" = true');
    if (ignoreId) {
      qb.andWhere('id <> :ignoreId', { ignoreId });
    }
    await qb.execute();
  }
}
