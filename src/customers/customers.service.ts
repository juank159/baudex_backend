import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { Customer, CustomerStatus } from './entities/customer.entity';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../common/dto/pagination-response.dto';
import { TenantAwareService } from '../common/services/tenant-aware.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    // Obtener tenant ID
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Verificar si el email ya existe en la organización actual (excluyendo soft-deleted)
    const existingEmail = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('LOWER(customer.email) = LOWER(:email)', {
        email: createCustomerDto.email,
      })
      .andWhere('customer.deletedAt IS NULL')
      .getOne();

    if (existingEmail) {
      throw new ConflictException(
        'El email ya está registrado en esta organización',
      );
    }

    // Verificar si el documento ya existe en la organización actual (excluyendo soft-deleted)
    const existingDocument = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('customer.documentType = :documentType', {
        documentType: createCustomerDto.documentType,
      })
      .andWhere('customer.documentNumber = :documentNumber', {
        documentNumber: createCustomerDto.documentNumber,
      })
      .andWhere('customer.deletedAt IS NULL')
      .getOne();

    if (existingDocument) {
      throw new ConflictException(
        'El número de documento ya está registrado en esta organización',
      );
    }

    const customer = this.customerRepository.create({
      ...createCustomerDto,
      organizationId: tenantId,
    });

    try {
      return await this.customerRepository.save(customer);
    } catch (error) {
      // Manejar errores de constraint de base de datos
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.constraint === 'UQ_customer_email_organization') {
          throw new ConflictException(
            'El email ya está registrado en esta organización',
          );
        }
        if (error.constraint === 'UQ_customer_document_organization') {
          throw new ConflictException(
            'El número de documento ya está registrado en esta organización',
          );
        }
        // Para cualquier otro constraint único
        throw new ConflictException(
          'Ya existe un cliente con estos datos en la organización',
        );
      }

      // Re-lanzar cualquier otro error
      throw error;
    }
  }

  async findAll(
    query: CustomerQueryDto,
  ): Promise<PaginatedResponseDto<Customer>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      documentType,
      city,
      state,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const queryBuilder = this.customerRepository.createQueryBuilder('customer');

    // ✅ MULTITENANT FIX: Filtrar por organización
    queryBuilder.where('customer.organizationId = :organizationId', {
      organizationId: tenantId,
    });

    // Filtros
    if (search) {
      queryBuilder.andWhere(
        '(customer.firstName ILIKE :search OR customer.lastName ILIKE :search OR customer.companyName ILIKE :search OR customer.email ILIKE :search OR customer.documentNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('customer.status = :status', { status });
    }

    if (documentType) {
      queryBuilder.andWhere('customer.documentType = :documentType', {
        documentType,
      });
    }

    if (city) {
      queryBuilder.andWhere('customer.city ILIKE :city', { city: `%${city}%` });
    }

    if (state) {
      queryBuilder.andWhere('customer.state ILIKE :state', {
        state: `%${state}%`,
      });
    }

    // Ordenamiento
    queryBuilder.orderBy(`customer.${sortBy}`, sortOrder);

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

  async findOne(id: string): Promise<Customer> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const customer = await this.customerRepository.findOne({
      where: { id, organizationId: tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  async findByDocument(
    documentType: string,
    documentNumber: string,
  ): Promise<Customer> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const customer = await this.customerRepository.findOne({
      where: {
        documentType: documentType as any,
        documentNumber,
        organizationId: tenantId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  async findByEmail(email: string): Promise<Customer> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const customer = await this.customerRepository.findOne({
      where: { email, organizationId: tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  /**
   * Buscar cliente por email para validación (sin lanzar excepción)
   */

  async findByEmailForValidation(
    email: string,
    excludeId?: string,
  ): Promise<Customer | null> {
    try {
      console.log(
        `🔍 [SERVICE] Validating email: "${email}", excludeId: "${excludeId}"`,
      );

      const tenantId = this.tenantAwareService.getTenantId();
      if (!tenantId) {
        console.log('❌ [SERVICE] No tenant ID found for email validation');
        return null;
      }

      const queryBuilder = this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', {
          organizationId: tenantId,
        })
        .andWhere('LOWER(customer.email) = LOWER(:email)', {
          email: email.trim(),
        })
        .andWhere('customer.deletedAt IS NULL'); // Excluir registros soft-deleted

      // Si hay un ID a excluir (para edición), agregarlo a la consulta
      if (excludeId && excludeId.trim() !== '') {
        queryBuilder.andWhere('customer.id != :excludeId', {
          excludeId: excludeId.trim(),
        });
        console.log(`🔍 [SERVICE] Excluding customer ID: "${excludeId}"`);
      }

      const result = await queryBuilder.getOne();

      console.log(
        `📧 [SERVICE] Email validation for "${email}": ${result ? 'EXISTS' : 'AVAILABLE'}`,
      );

      if (result) {
        console.log(
          `📧 [SERVICE] Found existing customer: ID=${result.id}, Email=${result.email}`,
        );
      }

      return result;
    } catch (error) {
      console.error('💥 [SERVICE] Error in findByEmailForValidation:', error);
      // En caso de error, retornar null para ser conservador
      return null;
    }
  }

  /**
   * Buscar cliente por documento para validación (sin lanzar excepción)
   */
  async findByDocumentForValidation(
    documentType: string,
    documentNumber: string,
    excludeId?: string,
  ): Promise<Customer | null> {
    try {
      console.log(
        `🔍 [SERVICE] Validating document: "${documentType}:${documentNumber}", excludeId: "${excludeId}"`,
      );

      const tenantId = this.tenantAwareService.getTenantId();
      if (!tenantId) {
        console.log('❌ [SERVICE] No tenant ID found for document validation');
        return null;
      }

      const queryBuilder = this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', {
          organizationId: tenantId,
        })
        .andWhere('customer.documentType = :documentType', {
          documentType: documentType.trim(),
        })
        .andWhere('customer.documentNumber = :documentNumber', {
          documentNumber: documentNumber.trim(),
        })
        .andWhere('customer.deletedAt IS NULL'); // Excluir registros soft-deleted

      // Si hay un ID a excluir (para edición), agregarlo a la consulta
      if (excludeId && excludeId.trim() !== '') {
        queryBuilder.andWhere('customer.id != :excludeId', {
          excludeId: excludeId.trim(),
        });
        console.log(`🔍 [SERVICE] Excluding customer ID: "${excludeId}"`);
      }

      const result = await queryBuilder.getOne();

      console.log(
        `📄 [SERVICE] Document validation for "${documentType}:${documentNumber}": ${result ? 'EXISTS' : 'AVAILABLE'}`,
      );

      if (result) {
        console.log(
          `📄 [SERVICE] Found existing customer: ID=${result.id}, Document=${result.documentType}:${result.documentNumber}`,
        );
      }

      return result;
    } catch (error) {
      console.error(
        '💥 [SERVICE] Error in findByDocumentForValidation:',
        error,
      );
      // En caso de error, retornar null para ser conservador
      return null;
    }
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findOne(id);
    const tenantId = customer.organizationId;

    // Verificar email único dentro de la organización si se está actualizando
    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const existingEmail = await this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', {
          organizationId: tenantId,
        })
        .andWhere('LOWER(customer.email) = LOWER(:email)', {
          email: updateCustomerDto.email,
        })
        .andWhere('customer.id != :id', { id })
        .andWhere('customer.deletedAt IS NULL')
        .getOne();
      if (existingEmail) {
        throw new ConflictException(
          'El email ya está registrado en esta organización',
        );
      }
    }

    // Verificar documento único dentro de la organización si se está actualizando
    if (
      updateCustomerDto.documentNumber &&
      (updateCustomerDto.documentNumber !== customer.documentNumber ||
        updateCustomerDto.documentType !== customer.documentType)
    ) {
      const existingDocument = await this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', {
          organizationId: tenantId,
        })
        .andWhere('customer.documentType = :documentType', {
          documentType:
            updateCustomerDto.documentType || customer.documentType,
        })
        .andWhere('customer.documentNumber = :documentNumber', {
          documentNumber: updateCustomerDto.documentNumber,
        })
        .andWhere('customer.id != :id', { id })
        .andWhere('customer.deletedAt IS NULL')
        .getOne();
      if (existingDocument) {
        throw new ConflictException(
          'El número de documento ya está registrado en esta organización',
        );
      }
    }

    Object.assign(customer, updateCustomerDto);
    return this.customerRepository.save(customer);
  }

  async updateStatus(id: string, status: CustomerStatus): Promise<Customer> {
    const customer = await this.findOne(id);
    customer.status = status;
    return this.customerRepository.save(customer);
  }

  async updateBalance(
    id: string,
    amount: number,
    operation: 'add' | 'subtract',
  ): Promise<Customer> {
    const customer = await this.findOne(id);

    if (operation === 'add') {
      customer.creditBalance = (customer.creditBalance || 0) + amount;
    } else {
      customer.creditBalance = Math.max(0, (customer.creditBalance || 0) - amount);
    }

    return this.customerRepository.save(customer);
  }

  /**
   * Obtener el saldo de créditos de un cliente
   */
  async getCreditBalance(id: string): Promise<number> {
    const customer = await this.findOne(id);
    return customer.creditBalance || 0;
  }

  async softDelete(id: string): Promise<{ message: string }> {
    const customer = await this.findOne(id);
    await this.customerRepository.softRemove(customer);
    return { message: 'Cliente eliminado exitosamente' };
  }

  async restore(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (!customer.deletedAt) {
      throw new BadRequestException('El cliente no está eliminado');
    }

    await this.customerRepository.restore(id);
    return this.findOne(id);
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    totalCreditLimit: number;
    totalBalance: number;
    activePercentage: number;
  }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const total = await this.customerRepository.count({
      where: { organizationId: tenantId },
    });
    const active = await this.customerRepository.count({
      where: { organizationId: tenantId, status: CustomerStatus.ACTIVE },
    });
    const inactive = await this.customerRepository.count({
      where: { organizationId: tenantId, status: CustomerStatus.INACTIVE },
    });
    const suspended = await this.customerRepository.count({
      where: { organizationId: tenantId, status: CustomerStatus.SUSPENDED },
    });

    const creditResult = await this.customerRepository
      .createQueryBuilder('customer')
      .select('SUM(customer.creditLimit)', 'totalCreditLimit')
      .addSelect('SUM(customer.currentBalance)', 'totalBalance')
      .where('customer.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere('customer.status = :status', { status: CustomerStatus.ACTIVE })
      .getRawOne();

    return {
      total,
      active,
      inactive,
      suspended,
      totalCreditLimit: parseFloat(creditResult.totalCreditLimit) || 0,
      totalBalance: parseFloat(creditResult.totalBalance) || 0,
      activePercentage:
        total > 0 ? Number(((active / total) * 100).toFixed(2)) : 0,
    };
  }

  async search(searchTerm: string, limit: number = 10): Promise<Customer[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .andWhere(
        '(customer.firstName ILIKE :search OR customer.lastName ILIKE :search OR customer.companyName ILIKE :search OR customer.email ILIKE :search OR customer.documentNumber ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .andWhere('customer.status = :status', { status: CustomerStatus.ACTIVE })
      .orderBy('customer.firstName', 'ASC')
      .limit(limit)
      .getMany();
  }

  // src/modules/customers/customers.service.ts - MÉTODOS ADICIONALES
  // Agregar estos métodos al CustomersService existente:

  // 🆕 MÉTODOS PARA TRABAJAR CON FACTURAS

  /**
   * Obtener cliente con sus facturas
   */
  async findOneWithInvoices(id: string): Promise<Customer> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const customer = await this.customerRepository.findOne({
      where: { id, organizationId: tenantId },
      relations: ['invoices'],
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  /**
   * Obtener facturas de un cliente
   */
  async getCustomerInvoices(
    customerId: string,
    status?: string,
    limit?: number,
  ): Promise<any[]> {
    const customer = await this.findOne(customerId);

    const query = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.invoices', 'invoices')
      .where('customer.id = :id', { id: customerId });

    if (status) {
      query.andWhere('invoices.status = :status', { status });
    }

    query.orderBy('invoices.date', 'DESC');

    if (limit) {
      query.limit(limit);
    }

    const result = await query.getOne();
    return result?.invoices || [];
  }

  /**
   * Actualizar estadísticas del cliente después de una factura
   */
  async updateCustomerStats(customerId: string): Promise<Customer> {
    const customer = await this.findOneWithInvoices(customerId);

    // Calcular estadísticas basadas en facturas
    const paidInvoices = customer.invoices.filter(
      (invoice) =>
        invoice.status === 'paid' || invoice.status === 'partially_paid',
    );

    // Actualizar campos calculados
    customer.totalOrders = customer.invoices.length;
    customer.totalPurchases = paidInvoices.reduce(
      (sum, invoice) => sum + invoice.total,
      0,
    );

    // Balance actual = facturas pendientes de pago
    customer.currentBalance = customer.invoices
      .filter(
        (invoice) =>
          invoice.status === 'pending' || invoice.status === 'partially_paid',
      )
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0);

    // Última compra
    if (customer.invoices.length > 0) {
      const lastInvoice = customer.invoices.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0];
      customer.lastPurchaseAt = lastInvoice.date;
    }

    return this.customerRepository.save(customer);
  }

  /**
   * Obtener clientes con facturas vencidas
   */
  async getCustomersWithOverdueInvoices(): Promise<Customer[]> {
    return this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.invoices', 'invoices')
      .where('invoices.dueDate < :today', { today: new Date() })
      .andWhere('invoices.status IN (:...statuses)', {
        statuses: ['pending', 'partially_paid'],
      })
      .andWhere('customer.status = :status', { status: CustomerStatus.ACTIVE })
      .orderBy('invoices.dueDate', 'ASC')
      .getMany();
  }

  /**
   * Obtener top clientes por ventas
   */
  async getTopCustomers(limit: number = 10): Promise<Customer[]> {
    return this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.invoices', 'invoices')
      .where('customer.status = :status', { status: CustomerStatus.ACTIVE })
      .orderBy('customer.totalPurchases', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Estadísticas mejoradas con datos de facturas
   */
  async getStatsWithInvoices(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    totalCreditLimit: number;
    totalBalance: number;
    activePercentage: number;
    customersWithOverdue: number;
    averagePurchaseAmount: number;
    topCustomers: Customer[];
  }> {
    const basicStats = await this.getStats();

    // Clientes con facturas vencidas
    const customersWithOverdue = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoin('customer.invoices', 'invoices')
      .where('invoices.dueDate < :today', { today: new Date() })
      .andWhere('invoices.status IN (:...statuses)', {
        statuses: ['pending', 'partially_paid'],
      })
      .distinctOn(['customer.id'])
      .getCount();

    // Promedio de compra
    const averageResult = await this.customerRepository
      .createQueryBuilder('customer')
      .select('AVG(customer.totalPurchases)', 'average')
      .where('customer.status = :status', { status: CustomerStatus.ACTIVE })
      .andWhere('customer.totalPurchases > 0')
      .getRawOne();

    // Top 5 clientes
    const topCustomers = await this.getTopCustomers(5);

    return {
      ...basicStats,
      customersWithOverdue,
      averagePurchaseAmount: parseFloat(averageResult.average) || 0,
      topCustomers,
    };
  }

  /**
   * Verificar si el cliente puede realizar una compra
   */
  async canMakePurchase(
    customerId: string,
    amount: number,
  ): Promise<{
    canPurchase: boolean;
    reason?: string;
    availableCredit: number;
  }> {
    const customer = await this.findOne(customerId);

    if (!customer.isActive) {
      return {
        canPurchase: false,
        reason: 'Cliente inactivo',
        availableCredit: 0,
      };
    }

    const newBalance = customer.currentBalance + amount;
    const availableCredit = customer.availableCredit;

    if (newBalance > customer.creditLimit) {
      return {
        canPurchase: false,
        reason: `Excede el límite de crédito. Disponible: ${availableCredit.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
        availableCredit,
      };
    }

    return {
      canPurchase: true,
      availableCredit,
    };
  }

  /**
   * Obtener resumen financiero del cliente
   */
  async getCustomerFinancialSummary(customerId: string): Promise<{
    customer: Customer;
    totalInvoices: number;
    paidInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
    totalSales: number;
    pendingAmount: number;
    overdueAmount: number;
    averageInvoiceAmount: number;
    lastInvoiceDate: Date | null;
    paymentHistory: any[];
  }> {
    const customer = await this.findOneWithInvoices(customerId);

    const paidInvoices = customer.invoices.filter(
      (inv) => inv.status === 'paid',
    );
    const pendingInvoices = customer.invoices.filter(
      (inv) => inv.status === 'pending' || inv.status === 'partially_paid',
    );
    const overdueInvoices = customer.invoices.filter((inv) => inv.isOverdue);

    const totalSales = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const pendingAmount = pendingInvoices.reduce(
      (sum, inv) => sum + inv.balanceDue,
      0,
    );
    const overdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + inv.balanceDue,
      0,
    );

    // Historial de pagos (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const paymentHistory = customer.invoices
      .filter(
        (inv) => inv.status === 'paid' && new Date(inv.date) >= sixMonthsAgo,
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map((inv) => ({
        invoiceNumber: inv.number,
        date: inv.date,
        amount: inv.total,
        dueDate: inv.dueDate,
      }));

    // Auto-heal: sincronizar currentBalance con el valor real calculado desde facturas.
    // Corrige clientes cuyo currentBalance quedó en 0 por el bug histórico donde
    // la creación de facturas a crédito no incrementaba este campo.
    if (customer.currentBalance !== pendingAmount) {
      await this.customerRepository.update(customerId, {
        currentBalance: pendingAmount,
      });
      customer.currentBalance = pendingAmount;
    }

    return {
      customer,
      totalInvoices: customer.invoices.length,
      paidInvoices: paidInvoices.length,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices: overdueInvoices.length,
      totalSales,
      pendingAmount,
      overdueAmount,
      averageInvoiceAmount: customer.averageInvoiceAmount,
      lastInvoiceDate: customer.lastInvoiceDate,
      paymentHistory,
    };
  }
}
