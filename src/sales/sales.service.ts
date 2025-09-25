import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination-response.dto';
import { InventoryService } from '../inventory/services/inventory.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private inventoryService: InventoryService,
    private dataSource: DataSource,
  ) {}

  async create(
    createSaleDto: CreateSaleDto,
    organizationId: string,
    userId: string,
  ): Promise<SaleResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el cliente existe
      const customer = await queryRunner.manager.findOne(Customer, {
        where: { id: createSaleDto.customerId, organizationId },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Verificar que todos los productos existen y tienen stock suficiente
      for (const item of createSaleDto.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.productId, organizationId },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} not found`,
          );
        }

        // Verificar stock disponible
        const availableStock = await this.inventoryService.getAvailableStock(
          item.productId,
          organizationId,
          queryRunner,
        );

        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`,
          );
        }
      }

      // Crear la venta
      const sale = queryRunner.manager.create(Sale, {
        ...createSaleDto,
        organizationId,
        createdById: userId,
        saleDate: new Date(),
      });

      // Generar número de venta
      const saleNumber = await this.generateSaleNumber(
        organizationId,
        queryRunner,
      );
      sale.saleNumber = saleNumber;

      const savedSale = await queryRunner.manager.save(sale);

      // Crear los items y procesar inventario FIFO
      const items = [];
      for (const itemDto of createSaleDto.items) {
        // Registrar salida de inventario usando FIFO (esto actualiza lotes)
        const saleResult = await this.inventoryService.registerSale(
          itemDto.productId,
          itemDto.quantity,
          itemDto.unitPrice,
          organizationId,
          userId,
          'sale',
          savedSale.id,
          {
            saleNumber: savedSale.saleNumber,
            customerReference: savedSale.customerReference,
          },
          undefined, // warehouseId - por ahora undefined, se puede agregar después
          queryRunner,
        );

        const item = queryRunner.manager.create(SaleItem, {
          ...itemDto,
          saleId: savedSale.id,
          organizationId,
          unitCost: saleResult.fifoResult.averageCost,
          totalCost: saleResult.fifoResult.totalCost,
        });

        // Calcular precios y rentabilidad
        item.calculatePrices();
        items.push(item);
      }

      await queryRunner.manager.save(items);

      // Actualizar totales de la venta
      savedSale.items = items;
      savedSale.calculateTotals();
      await queryRunner.manager.save(savedSale);

      await queryRunner.commitTransaction();

      return this.findOne(savedSale.id, organizationId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    query: SaleQueryDto,
    organizationId: string,
  ): Promise<PaginatedResponseDto<SaleResponseDto>> {
    const {
      page = 1,
      limit = 10,
      customerId,
      status,
      type,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = 'saleDate',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('sale.createdBy', 'createdBy')
      .leftJoinAndSelect('sale.confirmedBy', 'confirmedBy')
      .where('sale.organizationId = :organizationId', { organizationId })
      .andWhere('sale.deletedAt IS NULL');

    // Filtros
    if (customerId) {
      queryBuilder.andWhere('sale.customerId = :customerId', { customerId });
    }

    if (status) {
      queryBuilder.andWhere('sale.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('sale.type = :type', { type });
    }

    if (paymentStatus) {
      queryBuilder.andWhere('sale.paymentStatus = :paymentStatus', {
        paymentStatus,
      });
    }

    if (startDate) {
      queryBuilder.andWhere('sale.saleDate >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('sale.saleDate <= :endDate', { endDate });
    }

    if (search) {
      queryBuilder.andWhere(
        '(sale.saleNumber ILIKE :search OR sale.customerReference ILIKE :search OR customer.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Ordenamiento
    if (sortBy === 'customer') {
      queryBuilder.orderBy('customer.name', sortOrder);
    } else {
      queryBuilder.orderBy(`sale.${sortBy}`, sortOrder);
    }

    // Paginación
    const skip = (page - 1) * limit;
    const [sales, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const data = sales.map((sale) => this.toResponseDto(sale));

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

  async findOne(id: string, organizationId: string): Promise<SaleResponseDto> {
    const sale = await this.saleRepository.findOne({
      where: { id, organizationId, deletedAt: null },
      relations: [
        'customer',
        'items',
        'items.product',
        'createdBy',
        'confirmedBy',
        'invoice',
      ],
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return this.toResponseDto(sale);
  }

  async update(
    id: string,
    updateSaleDto: UpdateSaleDto,
    organizationId: string,
  ): Promise<SaleResponseDto> {
    const sale = await this.saleRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (!sale.isEditable) {
      throw new BadRequestException(
        'Sale cannot be modified in current status',
      );
    }

    // TODO: Implementar actualización completa con recálculo de inventario
    await this.saleRepository.update(
      { id, organizationId },
      { ...updateSaleDto, updatedAt: new Date() },
    );

    return this.findOne(id, organizationId);
  }

  async confirm(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<SaleResponseDto> {
    const sale = await this.saleRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    sale.confirm(userId);
    await this.saleRepository.save(sale);

    return this.findOne(id, organizationId);
  }

  async deliver(id: string, organizationId: string): Promise<SaleResponseDto> {
    const sale = await this.saleRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    sale.deliver();
    await this.saleRepository.save(sale);

    return this.findOne(id, organizationId);
  }

  async linkToInvoice(
    id: string,
    invoiceId: string,
    organizationId: string,
  ): Promise<SaleResponseDto> {
    const sale = await this.saleRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    sale.linkToInvoice(invoiceId);
    await this.saleRepository.save(sale);

    return this.findOne(id, organizationId);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const sale = await this.saleRepository.findOne({
      where: { id, organizationId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (!sale.isEditable) {
      throw new BadRequestException('Sale cannot be deleted in current status');
    }

    // Soft delete
    await this.saleRepository.update(
      { id, organizationId },
      { deletedAt: new Date() },
    );
  }

  async getSalesStats(organizationId: string): Promise<{
    total: number;
    totalValue: number;
    averageSaleValue: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byPaymentStatus: Record<string, number>;
    topCustomers: Array<{
      customerId: string;
      customerName: string;
      totalSales: number;
      totalValue: number;
    }>;
  }> {
    const sales = await this.saleRepository.find({
      where: { organizationId, deletedAt: null },
      relations: ['customer'],
    });

    const stats = {
      total: sales.length,
      totalValue: 0,
      averageSaleValue: 0,
      byStatus: {},
      byType: {},
      byPaymentStatus: {},
      topCustomers: [],
    };

    // Calcular estadísticas básicas
    sales.forEach((sale) => {
      stats.totalValue += sale.total;
      stats.byStatus[sale.status] = (stats.byStatus[sale.status] || 0) + 1;
      stats.byType[sale.type] = (stats.byType[sale.type] || 0) + 1;
      stats.byPaymentStatus[sale.paymentStatus] =
        (stats.byPaymentStatus[sale.paymentStatus] || 0) + 1;
    });

    stats.averageSaleValue =
      stats.total > 0 ? stats.totalValue / stats.total : 0;

    // Top clientes
    const customerStats = new Map();
    sales.forEach((sale) => {
      const customerId = sale.customerId;
      const customerName = (sale.customer as any)?.name || 'Unknown';

      if (!customerStats.has(customerId)) {
        customerStats.set(customerId, {
          customerId,
          customerName,
          totalSales: 0,
          totalValue: 0,
        });
      }

      const customerStat = customerStats.get(customerId);
      customerStat.totalSales++;
      customerStat.totalValue += sale.total;
    });

    stats.topCustomers = Array.from(customerStats.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    return stats;
  }

  private async generateSaleNumber(
    organizationId: string,
    queryRunner: QueryRunner,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const count = await queryRunner.manager.count(Sale, {
      where: { organizationId },
    });

    const sequence = String(count + 1).padStart(6, '0');
    return `SAL-${year}${month}-${sequence}`;
  }

  private toResponseDto(sale: Sale): SaleResponseDto {
    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      deliveryDate: sale.deliveryDate,
      status: sale.status,
      type: sale.type,
      paymentStatus: sale.paymentStatus,
      currency: sale.currency,
      subtotal: sale.subtotal,
      taxPercentage: sale.taxPercentage,
      taxAmount: sale.taxAmount,
      discountPercentage: sale.discountPercentage,
      discountAmount: sale.discountAmount,
      shippingCost: sale.shippingCost,
      total: sale.total,
      totalCost: sale.totalCost,
      grossProfit: sale.grossProfit,
      profitMargin: sale.profitMargin,
      notes: sale.notes,
      deliveryInstructions: sale.deliveryInstructions,
      customerReference: sale.customerReference,
      metadata: sale.metadata,
      organizationId: sale.organizationId,
      customerId: sale.customerId,
      customer: sale.customer
        ? {
            id: sale.customer.id,
            name: (sale.customer as any).name,
            email: sale.customer.email,
            phone: sale.customer.phone,
          }
        : null,
      createdById: sale.createdById,
      createdBy: sale.createdBy
        ? {
            id: sale.createdBy.id,
            name: (sale.createdBy as any).name,
          }
        : null,
      confirmedById: sale.confirmedById,
      confirmedBy: sale.confirmedBy
        ? {
            id: sale.confirmedBy.id,
            name: (sale.confirmedBy as any).name,
          }
        : null,
      confirmedAt: sale.confirmedAt,
      invoiceId: sale.invoiceId,
      items:
        sale.items?.map((item) => ({
          id: item.id,
          lineNumber: item.lineNumber,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          discountPercentage: item.discountPercentage,
          discountAmount: item.discountAmount,
          finalPrice: item.finalPrice,
          itemProfit: item.itemProfit,
          profitMargin: item.profitMargin,
          notes: item.notes,
          productId: item.productId,
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                sku: item.product.sku,
              }
            : null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })) || [],
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      deletedAt: sale.deletedAt,
      isEditable: sale.isEditable,
      canBeInvoiced: sale.canBeInvoiced,
      isCompleted: sale.isCompleted,
      totalQuantity: sale.totalQuantity,
      totalItems: sale.totalItems,
      averageItemValue: sale.averageItemValue,
      profitMarginPercentage: sale.profitMarginPercentage,
    };
  }
}
