import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { AddPaymentDto } from './dto/payment.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../common/dto/pagination-response.dto';
import { CustomersService } from '../customers/customers.service';
import { ProductService } from '../products/products.service';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    private readonly customersService: CustomersService,
    private readonly productsService: ProductService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createInvoiceDto: CreateInvoiceDto,
    createdById: string,
  ): Promise<Invoice> {
    // Verificar que el cliente existe
    const customer = await this.customersService.findOne(
      createInvoiceDto.customerId,
    );

    // Verificar productos y stock
    for (const itemDto of createInvoiceDto.items) {
      if (itemDto.productId) {
        const product = await this.productsService.findOne(itemDto.productId);
        const isValid = await this.productsService.validateStockForSale(
          itemDto.productId,
          itemDto.quantity,
        );
        if (!isValid) {
          throw new BadRequestException(
            `Stock insuficiente para el producto: ${product.name}`,
          );
        }
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Crear factura
      const invoice = manager.create(Invoice, {
        ...createInvoiceDto,
        date: createInvoiceDto.date
          ? new Date(createInvoiceDto.date)
          : new Date(),
        dueDate: createInvoiceDto.dueDate
          ? new Date(createInvoiceDto.dueDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días por defecto
        createdById,
        status: InvoiceStatus.DRAFT,
      });

      const savedInvoice = await manager.save(Invoice, invoice);

      // Crear items
      const items = createInvoiceDto.items.map((itemDto) =>
        manager.create(InvoiceItem, {
          ...itemDto,
          invoiceId: savedInvoice.id,
        }),
      );

      await manager.save(InvoiceItem, items);

      // Cargar factura completa
      const completeInvoice = await manager.findOne(Invoice, {
        where: { id: savedInvoice.id },
        relations: ['items', 'customer', 'createdBy'],
      });

      // Calcular totales
      completeInvoice.calculateTotals();
      await manager.save(Invoice, completeInvoice);

      return completeInvoice;
    });
  }

  async findAll(
    query: InvoiceQueryDto,
  ): Promise<PaginatedResponseDto<Invoice>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      paymentMethod,
      customerId,
      createdById,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .leftJoinAndSelect('invoice.items', 'items');

    // Filtros
    if (search) {
      queryBuilder.andWhere(
        '(invoice.number ILIKE :search OR customer.firstName ILIKE :search OR customer.lastName ILIKE :search OR customer.companyName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('invoice.status = :status', { status });
    }

    if (paymentMethod) {
      queryBuilder.andWhere('invoice.paymentMethod = :paymentMethod', {
        paymentMethod,
      });
    }

    if (customerId) {
      queryBuilder.andWhere('invoice.customerId = :customerId', { customerId });
    }

    if (createdById) {
      queryBuilder.andWhere('invoice.createdById = :createdById', {
        createdById,
      });
    }

    if (startDate) {
      queryBuilder.andWhere('invoice.date >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('invoice.date <= :endDate', { endDate });
    }

    if (minAmount !== undefined) {
      queryBuilder.andWhere('invoice.total >= :minAmount', { minAmount });
    }

    if (maxAmount !== undefined) {
      queryBuilder.andWhere('invoice.total <= :maxAmount', { maxAmount });
    }

    // Ordenamiento
    queryBuilder.orderBy(`invoice.${sortBy}`, sortOrder);

    // Paginación
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    const meta: PaginationMetaDto = {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNextPage: page < Math.ceil(totalItems / limit),
      hasPreviousPage: page > 1,
    };

    return { data, meta };
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['items', 'customer', 'createdBy', 'items.product'],
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return invoice;
  }

  async findByNumber(number: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { number },
      relations: ['items', 'customer', 'createdBy', 'items.product'],
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return invoice;
  }

  async update(
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id);

    // No permitir editar facturas pagadas o canceladas
    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'No se puede editar una factura pagada o cancelada',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Actualizar factura
      Object.assign(invoice, updateInvoiceDto);

      // Si se proporcionan items, actualizar
      if (updateInvoiceDto.items) {
        // Eliminar items existentes
        await manager.delete(InvoiceItem, { invoiceId: id });

        // Crear nuevos items
        const items = updateInvoiceDto.items.map((itemDto) =>
          manager.create(InvoiceItem, {
            ...itemDto,
            invoiceId: id,
          }),
        );

        await manager.save(InvoiceItem, items);
      }

      // Recalcular totales
      const updatedInvoice = await manager.findOne(Invoice, {
        where: { id },
        relations: ['items'],
      });

      updatedInvoice.calculateTotals();
      await manager.save(Invoice, updatedInvoice);

      return this.findOne(id);
    });
  }

  async confirm(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden confirmar facturas en borrador',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Reducir stock de productos
      for (const item of invoice.items) {
        if (item.productId) {
          await this.productsService.reduceStockForSale(
            item.productId,
            item.quantity,
          );
        }
      }

      // Cambiar estado a pendiente
      invoice.status = InvoiceStatus.PENDING;
      await manager.save(Invoice, invoice);

      return this.findOne(id);
    });
  }

  async addPayment(id: string, paymentDto: AddPaymentDto): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('La factura ya está pagada completamente');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede agregar pago a una factura cancelada',
      );
    }

    const remainingBalance = invoice.balanceDue;
    if (paymentDto.amount > remainingBalance) {
      throw new BadRequestException(
        'El monto del pago excede el saldo pendiente',
      );
    }

    // Actualizar montos
    invoice.paidAmount += paymentDto.amount;
    invoice.balanceDue = invoice.total - invoice.paidAmount;

    // Actualizar estado
    if (invoice.balanceDue <= 0) {
      invoice.status = InvoiceStatus.PAID;
    } else {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    }

    await this.invoiceRepository.save(invoice);

    // Actualizar balance del cliente
    await this.customersService.updateBalance(
      invoice.customerId,
      paymentDto.amount,
      'subtract',
    );

    return this.findOne(id);
  }

  async cancel(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('No se puede cancelar una factura pagada');
    }

    return this.dataSource.transaction(async (manager) => {
      // Si la factura estaba confirmada, restaurar stock
      if (
        invoice.status === InvoiceStatus.PENDING ||
        invoice.status === InvoiceStatus.PARTIALLY_PAID
      ) {
        for (const item of invoice.items) {
          if (item.productId) {
            await this.productsService.updateStock(
              item.productId,
              item.quantity,
              'add',
            );
          }
        }
      }

      // Cancelar factura
      invoice.status = InvoiceStatus.CANCELLED;
      await manager.save(Invoice, invoice);

      return this.findOne(id);
    });
  }

  async getStats(): Promise<{
    total: number;
    draft: number;
    pending: number;
    paid: number;
    overdue: number;
    cancelled: number;
    totalSales: number;
    pendingAmount: number;
    overdueAmount: number;
  }> {
    const total = await this.invoiceRepository.count();
    const draft = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.DRAFT },
    });
    const pending = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.PENDING },
    });
    const paid = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.PAID },
    });
    const cancelled = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.CANCELLED },
    });

    // Facturas vencidas
    const overdue = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.dueDate < :today', { today: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
      })
      .getCount();

    // Montos
    const salesResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total)', 'totalSales')
      .addSelect('SUM(invoice.balanceDue)', 'pendingAmount')
      .where('invoice.status != :cancelled', {
        status: InvoiceStatus.CANCELLED,
      })
      .getRawOne();

    const overdueResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.balanceDue)', 'overdueAmount')
      .where('invoice.dueDate < :today', { today: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
      })
      .getRawOne();

    return {
      total,
      draft,
      pending,
      paid,
      overdue,
      cancelled,
      totalSales: parseFloat(salesResult.totalSales) || 0,
      pendingAmount: parseFloat(salesResult.pendingAmount) || 0,
      overdueAmount: parseFloat(overdueResult.overdueAmount) || 0,
    };
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    return this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .where('invoice.dueDate < :today', { today: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
      })
      .orderBy('invoice.dueDate', 'ASC')
      .getMany();
  }

  async softDelete(id: string): Promise<{ message: string }> {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('No se puede eliminar una factura pagada');
    }

    await this.invoiceRepository.softRemove(invoice);
    return { message: 'Factura eliminada exitosamente' };
  }
}
