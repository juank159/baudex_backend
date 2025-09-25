import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemporaryProduct } from './entities/temporary-product.entity';

export interface CreateTemporaryProductDto {
  name: string;
  description?: string;
  unitPrice: number;
  unit?: string;
  currency?: string;
  category?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class TemporaryProductService {
  constructor(
    @InjectRepository(TemporaryProduct)
    private readonly temporaryProductRepository: Repository<TemporaryProduct>,
  ) {}

  async create(
    createDto: CreateTemporaryProductDto,
  ): Promise<TemporaryProduct> {
    const temporaryProduct = this.temporaryProductRepository.create({
      name: createDto.name,
      description: createDto.description,
      unitPrice: createDto.unitPrice,
      unit: createDto.unit || 'pcs',
      currency: createDto.currency || 'COP',
      category: createDto.category || 'Sin categoría',
      metadata: createDto.metadata,
    });

    return this.temporaryProductRepository.save(temporaryProduct);
  }

  async findOne(id: string): Promise<TemporaryProduct> {
    return this.temporaryProductRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<TemporaryProduct[]> {
    return this.temporaryProductRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(): Promise<{
    total: number;
    totalValue: number;
    avgPrice: number;
  }> {
    const result = await this.temporaryProductRepository
      .createQueryBuilder('tp')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(tp.unitPrice)', 'totalValue')
      .addSelect('AVG(tp.unitPrice)', 'avgPrice')
      .getRawOne();

    return {
      total: parseInt(result.total) || 0,
      totalValue: parseFloat(result.totalValue) || 0,
      avgPrice: parseFloat(result.avgPrice) || 0,
    };
  }
}
