import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { SupplierResponseDto } from './dto/supplier-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination-response.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  async create(
    createSupplierDto: CreateSupplierDto,
    organizationId: string,
  ): Promise<SupplierResponseDto> {
    // Verificar si el código ya existe (si se proporciona)
    if (createSupplierDto.code) {
      const existingSupplier = await this.supplierRepository.findOne({
        where: {
          code: createSupplierDto.code,
          organizationId,
          deletedAt: null,
        },
      });

      if (existingSupplier) {
        throw new ConflictException('El código del proveedor ya existe');
      }
    }

    // Verificar documento único si se proporciona tipo y número
    if (createSupplierDto.documentType && createSupplierDto.documentNumber) {
      const existingByDocument = await this.supplierRepository.findOne({
        where: {
          documentType: createSupplierDto.documentType,
          documentNumber: createSupplierDto.documentNumber,
          organizationId,
          deletedAt: null,
        },
      });

      if (existingByDocument) {
        throw new ConflictException(
          `Ya existe un proveedor con ${createSupplierDto.documentType}: ${createSupplierDto.documentNumber} en esta organización`,
        );
      }
    }

    const supplier = this.supplierRepository.create({
      ...createSupplierDto,
      organizationId,
    });

    const savedSupplier = await this.supplierRepository.save(supplier);
    return this.toResponseDto(savedSupplier);
  }

  async findAll(
    query: SupplierQueryDto,
    organizationId: string,
  ): Promise<PaginatedResponseDto<SupplierResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      city,
      country,
      sortBy = 'name',
      sortOrder = 'ASC',
    } = query;

    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.organizationId = :organizationId', { organizationId })
      .andWhere('supplier.deletedAt IS NULL');

    // Filtros
    if (search) {
      queryBuilder.andWhere(
        '(supplier.name ILIKE :search OR supplier.code ILIKE :search OR supplier.email ILIKE :search OR supplier.documentNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('supplier.status = :status', { status });
    }

    if (city) {
      queryBuilder.andWhere('supplier.city ILIKE :city', { city: `%${city}%` });
    }

    if (country) {
      queryBuilder.andWhere('supplier.country ILIKE :country', {
        country: `%${country}%`,
      });
    }

    // Ordenamiento - Normalizar sortOrder a mayúsculas
    const normalizedSortOrder =
      sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    queryBuilder.orderBy(`supplier.${sortBy}`, normalizedSortOrder);

    // Paginación
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [suppliers, total] = await queryBuilder.getManyAndCount();

    const data = suppliers.map((supplier) => this.toResponseDto(supplier));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<SupplierResponseDto> {
    const supplier = await this.supplierRepository.findOne({
      where: { id, organizationId, deletedAt: null },
      relations: ['purchaseOrders', 'purchaseHistory'],
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return this.toResponseDto(supplier);
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
    organizationId: string,
  ): Promise<SupplierResponseDto> {
    const supplier = await this.findOne(id, organizationId);

    // Verificar si el código ya existe (si se cambia)
    if (updateSupplierDto.code && updateSupplierDto.code !== supplier.code) {
      const existingSupplier = await this.supplierRepository.findOne({
        where: {
          code: updateSupplierDto.code,
          organizationId,
          deletedAt: null,
        },
      });

      if (existingSupplier && existingSupplier.id !== id) {
        throw new ConflictException('El código del proveedor ya existe');
      }
    }

    // Verificar documento único si se proporciona tipo y número (y han cambiado)
    if (updateSupplierDto.documentType && updateSupplierDto.documentNumber) {
      const hasChanged =
        updateSupplierDto.documentType !== supplier.documentType ||
        updateSupplierDto.documentNumber !== supplier.documentNumber;

      if (hasChanged) {
        const existingByDocument = await this.supplierRepository.findOne({
          where: {
            documentType: updateSupplierDto.documentType,
            documentNumber: updateSupplierDto.documentNumber,
            organizationId,
            deletedAt: null,
          },
        });

        if (existingByDocument && existingByDocument.id !== id) {
          throw new ConflictException(
            `Ya existe un proveedor con ${updateSupplierDto.documentType}: ${updateSupplierDto.documentNumber} en esta organización`,
          );
        }
      }
    }

    // Agregar el ID al DTO para el validador de unicidad
    updateSupplierDto.id = id;

    await this.supplierRepository.update(
      { id, organizationId },
      { ...updateSupplierDto, updatedAt: new Date() },
    );

    return this.findOne(id, organizationId);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const supplier = await this.findOne(id, organizationId);

    // Soft delete
    await this.supplierRepository.update(
      { id, organizationId },
      { deletedAt: new Date() },
    );
  }

  async findByCode(
    code: string,
    organizationId: string,
  ): Promise<SupplierResponseDto | null> {
    const supplier = await this.supplierRepository.findOne({
      where: { code, organizationId, deletedAt: null },
    });

    return supplier ? this.toResponseDto(supplier) : null;
  }

  async getActiveSuppliers(
    organizationId: string,
  ): Promise<SupplierResponseDto[]> {
    const suppliers = await this.supplierRepository.find({
      where: {
        organizationId,
        status: 'active' as any,
        deletedAt: null,
      },
      order: { name: 'ASC' },
    });

    return suppliers.map((supplier) => this.toResponseDto(supplier));
  }

  async getSupplierStats(organizationId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    blocked: number;
    topSuppliers: Array<{
      id: string;
      name: string;
      totalOrders: number;
      totalAmount: number;
    }>;
  }> {
    const stats = await this.supplierRepository
      .createQueryBuilder('supplier')
      .select('supplier.status, COUNT(*) as count')
      .where('supplier.organizationId = :organizationId', { organizationId })
      .andWhere('supplier.deletedAt IS NULL')
      .groupBy('supplier.status')
      .getRawMany();

    const statusCounts = {
      active: 0,
      inactive: 0,
      blocked: 0,
    };

    stats.forEach((stat) => {
      statusCounts[stat.status] = parseInt(stat.count);
    });

    const total = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    // TODO: Implementar topSuppliers cuando tengamos órdenes de compra
    const topSuppliers = [];

    return {
      total,
      ...statusCounts,
      topSuppliers,
    };
  }

  async findByDocumentTypeAndNumber(
    documentType: string,
    documentNumber: string,
    organizationId: string,
    excludeId?: string,
  ): Promise<Supplier | null> {
    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.documentType = :documentType', { documentType })
      .andWhere('supplier.documentNumber = :documentNumber', { documentNumber })
      .andWhere('supplier.organizationId = :organizationId', { organizationId })
      .andWhere('supplier.deletedAt IS NULL');

    // Excluir el proveedor actual si se está editando
    if (excludeId) {
      queryBuilder.andWhere('supplier.id != :excludeId', { excludeId });
    }

    return await queryBuilder.getOne();
  }

  private toResponseDto(supplier: Supplier): SupplierResponseDto {
    return {
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      documentType: supplier.documentType,
      documentNumber: supplier.documentNumber,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      mobile: supplier.mobile,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      country: supplier.country,
      postalCode: supplier.postalCode,
      website: supplier.website,
      status: supplier.status,
      currency: supplier.currency,
      paymentTermsDays: supplier.paymentTermsDays,
      creditLimit: supplier.creditLimit,
      discountPercentage: supplier.discountPercentage,
      notes: supplier.notes,
      metadata: supplier.metadata,
      organizationId: supplier.organizationId,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      deletedAt: supplier.deletedAt,
      displayName: supplier.displayName,
      fullAddress: supplier.fullAddress,
      isActive: supplier.isActive,
    };
  }
}
