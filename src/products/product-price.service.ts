import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import {
  ProductPrice,
  PriceType,
  PriceStatus,
} from './entities/product-price.entity';
import { CreateProductPriceDto } from './dto/create-product-price.dto';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';

@Injectable()
export class ProductPriceService {
  private readonly productPriceRepository: Repository<ProductPrice>;

  constructor(private readonly dataSource: DataSource) {
    this.productPriceRepository = dataSource.getRepository(ProductPrice);
  }

  async create(
    productId: string,
    createPriceDto: CreateProductPriceDto,
  ): Promise<ProductPrice> {
    // Verificar si ya existe un precio del mismo tipo para este producto
    const existingPrice = await this.productPriceRepository.findOne({
      where: {
        productId,
        type: createPriceDto.type,
        status: PriceStatus.ACTIVE,
      },
    });

    if (existingPrice) {
      throw new ConflictException(
        `Ya existe un precio activo del tipo ${createPriceDto.type} para este producto`,
      );
    }

    const price = this.productPriceRepository.create({
      ...createPriceDto,
      productId,
    });

    return this.productPriceRepository.save(price);
  }

  async findAll(productId: string): Promise<ProductPrice[]> {
    return this.productPriceRepository.find({
      where: { productId },
      order: { type: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ProductPrice> {
    const price = await this.productPriceRepository.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!price) {
      throw new NotFoundException('Precio no encontrado');
    }

    return price;
  }

  async findByType(
    productId: string,
    type: PriceType,
  ): Promise<ProductPrice | null> {
    return this.productPriceRepository.findOne({
      where: {
        productId,
        type,
        status: PriceStatus.ACTIVE,
      },
    });
  }

  async update(
    id: string,
    updatePriceDto: UpdateProductPriceDto,
  ): Promise<ProductPrice> {
    const price = await this.findOne(id);

    // Si se está cambiando el tipo, verificar que no exista otro precio del mismo tipo
    if (updatePriceDto.type && updatePriceDto.type !== price.type) {
      const existingPrice = await this.productPriceRepository.findOne({
        where: {
          productId: price.productId,
          type: updatePriceDto.type,
          status: PriceStatus.ACTIVE,
        },
      });

      if (existingPrice && existingPrice.id !== id) {
        throw new ConflictException(
          `Ya existe un precio activo del tipo ${updatePriceDto.type} para este producto`,
        );
      }
    }

    Object.assign(price, updatePriceDto);
    return this.productPriceRepository.save(price);
  }

  async updateStatus(id: string, status: PriceStatus): Promise<ProductPrice> {
    const price = await this.findOne(id);
    price.status = status;
    return this.productPriceRepository.save(price);
  }

  async softDelete(id: string): Promise<void> {
    const price = await this.findOne(id);
    await this.productPriceRepository.softRemove(price);
  }

  async restore(id: string): Promise<ProductPrice> {
    const price = await this.productPriceRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!price) {
      throw new NotFoundException('Precio no encontrado');
    }

    await this.productPriceRepository.restore(id);
    return this.findOne(id);
  }

  async calculateProfitMargin(
    priceId: string,
    costPrice: number,
  ): Promise<number> {
    const price = await this.findOne(priceId);
    if (costPrice <= 0) return 0;

    const margin = ((price.finalAmount - costPrice) / costPrice) * 100;

    // Actualizar el margen en la base de datos
    price.profitMargin = Math.round(margin * 100) / 100; // Redondear a 2 decimales
    await this.productPriceRepository.save(price);

    return margin;
  }

  async bulkUpdatePrices(
    productId: string,
    priceUpdates: { type: PriceType; amount: number }[],
  ): Promise<ProductPrice[]> {
    const prices = await this.findAll(productId);
    const updatedPrices: ProductPrice[] = [];

    for (const update of priceUpdates) {
      const price = prices.find(
        (p) => p.type === update.type && p.status === PriceStatus.ACTIVE,
      );
      if (price) {
        price.amount = update.amount;
        updatedPrices.push(await this.productPriceRepository.save(price));
      }
    }

    return updatedPrices;
  }
}
