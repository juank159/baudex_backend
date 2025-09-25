import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private dataSource: DataSource,
  ) {}

  async create(
    organizationId: string,
    createWarehouseDto: CreateWarehouseDto,
  ): Promise<Warehouse> {
    // Verificar que el código sea único dentro de la organización
    const existingWarehouse = await this.warehouseRepository.findOne({
      where: {
        code: createWarehouseDto.code,
        organizationId,
        deletedAt: null,
      },
    });

    if (existingWarehouse) {
      throw new ConflictException('Ya existe un almacén con este código');
    }

    const warehouse = this.warehouseRepository.create({
      ...createWarehouseDto,
      organizationId,
    });

    return await this.warehouseRepository.save(warehouse);
  }

  async findAll(
    organizationId: string,
    query: WarehouseQueryDto,
  ): Promise<{
    warehouses: Warehouse[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search, isActive } = query;
    const offset = (page - 1) * limit;

    const queryBuilder = this.warehouseRepository
      .createQueryBuilder('warehouse')
      .where('warehouse.organizationId = :organizationId', { organizationId })
      .andWhere('warehouse.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(warehouse.name ILIKE :search OR warehouse.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('warehouse.isActive = :isActive', { isActive });
    }

    queryBuilder.orderBy('warehouse.name', 'ASC').skip(offset).take(limit);

    const [warehouses, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      warehouses,
      total,
      page,
      totalPages,
    };
  }

  async findAllActive(organizationId: string): Promise<Warehouse[]> {
    return await this.warehouseRepository.find({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
      },
      order: { name: 'ASC' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Almacén no encontrado');
    }

    return warehouse;
  }

  async update(
    organizationId: string,
    id: string,
    updateWarehouseDto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(organizationId, id);

    // Si se está actualizando el código, verificar que sea único
    if (updateWarehouseDto.code && updateWarehouseDto.code !== warehouse.code) {
      const existingWarehouse = await this.warehouseRepository.findOne({
        where: {
          code: updateWarehouseDto.code,
          organizationId,
          deletedAt: null,
        },
      });

      if (existingWarehouse && existingWarehouse.id !== id) {
        throw new ConflictException('Ya existe un almacén con este código');
      }
    }

    Object.assign(warehouse, updateWarehouseDto);
    return await this.warehouseRepository.save(warehouse);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const warehouse = await this.findOne(organizationId, id);

    // Soft delete
    warehouse.deletedAt = new Date();
    await this.warehouseRepository.save(warehouse);
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<Warehouse | null> {
    return await this.warehouseRepository.findOne({
      where: {
        code,
        organizationId,
        deletedAt: null,
      },
    });
  }

  async setMainWarehouse(
    organizationId: string,
    warehouseId: string,
  ): Promise<{ message: string; warehouse: Warehouse }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el almacén existe y está activo
      const warehouse = await queryRunner.manager.findOne(Warehouse, {
        where: {
          id: warehouseId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!warehouse) {
        throw new NotFoundException('Almacén no encontrado o no está activo');
      }

      // Si ya es el almacén principal, no hacer nada
      if (warehouse.isMainWarehouse) {
        await queryRunner.rollbackTransaction();
        return {
          message: `${warehouse.name} ya es el almacén principal`,
          warehouse,
        };
      }

      // Desmarcar todos los almacenes como principales para esta organización
      await queryRunner.manager.update(
        Warehouse,
        { organizationId, isMainWarehouse: true },
        { isMainWarehouse: false },
      );

      // Marcar el nuevo almacén como principal
      await queryRunner.manager.update(
        Warehouse,
        { id: warehouseId, organizationId },
        { isMainWarehouse: true },
      );

      // Actualizar la referencia en la organización
      await queryRunner.manager.update(
        Organization,
        { id: organizationId },
        { mainWarehouseId: warehouseId },
      );

      // Refrescar el objeto warehouse
      const updatedWarehouse = await queryRunner.manager.findOne(Warehouse, {
        where: { id: warehouseId, organizationId },
      });

      await queryRunner.commitTransaction();

      console.log(
        `🏪 Almacén principal cambiado: ${warehouse.name} para organización ${organizationId}`,
      );

      return {
        message: `${warehouse.name} establecido como almacén principal exitosamente`,
        warehouse: updatedWarehouse!,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('❌ Error cambiando almacén principal:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
