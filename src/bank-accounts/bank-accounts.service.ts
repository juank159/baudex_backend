// src/bank-accounts/bank-accounts.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { BankAccount } from './entities/bank-account.entity';
import {
  BankAccountMovement,
  BankAccountMovementType,
} from './entities/bank-account-movement.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { BankAccountQueryDto } from './dto/bank-account-query.dto';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { Payment } from '../invoices/entities/payment.entity';
import { CreditPayment } from '../customer-credits/entities/credit-payment.entity';
import {
  addOneDay,
  toUtcAtTenantMidnight,
} from '../common/utils/timezone-range.util';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

export interface BankAccountSummary {
  id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  type: string;
  icon?: string;
  currentBalance: number;

  // Histórico: TODOS los pagos recibidos por esta cuenta (sin filtro de fecha).
  totalReceived: number;
  paymentCount: number;
  creditPaymentTotal: number;
  creditPaymentCount: number;

  // Período: solo pagos cuya paymentDate cae dentro del rango consultado
  // en la TZ de la organización. Si no hay rango, estos campos son 0.
  totalReceivedPeriod: number;
  paymentCountPeriod: number;
  creditPaymentTotalPeriod: number;
  creditPaymentCountPeriod: number;

  isDefault: boolean;
  isActive: boolean;
}

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepository: Repository<BankAccount>,
    @InjectRepository(BankAccountMovement)
    private readonly movementRepository: Repository<BankAccountMovement>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(CreditPayment)
    private readonly creditPaymentRepository: Repository<CreditPayment>,
    private readonly tenantAwareService: TenantAwareService,
    @InjectEntityManager() private readonly em: EntityManager,
  ) {}

  /**
   * Crear una nueva cuenta bancaria
   */
  async create(
    createDto: CreateBankAccountDto,
    createdById?: string,
  ): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Validar unicidad: combinación banco + número de cuenta (case-insensitive para nombre)
    if (createDto.accountNumber) {
      await this.validateUniqueBankAccountCombination(
        tenantId,
        createDto.name,
        createDto.accountNumber,
      );
    }

    // Si es la primera cuenta o se marca como default, asegurar que sea la única default
    if (createDto.isDefault) {
      await this.clearDefaultFlag(tenantId);
    }

    // Si es la primera cuenta del tenant, marcarla como default
    const existingAccounts = await this.bankAccountRepository.count({
      where: { organizationId: tenantId },
    });

    const bankAccount = this.bankAccountRepository.create({
      ...createDto,
      organizationId: tenantId,
      createdById,
      isDefault: createDto.isDefault || existingAccounts === 0, // Primera cuenta es default
    });

    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Obtener todas las cuentas bancarias del tenant
   */
  async findAll(query: BankAccountQueryDto = {}): Promise<BankAccount[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const queryBuilder = this.bankAccountRepository.createQueryBuilder('ba');

    queryBuilder.where('ba.organizationId = :organizationId', {
      organizationId: tenantId,
    });

    // Filtrar por tipo
    if (query.type) {
      queryBuilder.andWhere('ba.type = :type', { type: query.type });
    }

    // Filtrar por activo (por defecto solo activos)
    if (!query.includeInactive) {
      queryBuilder.andWhere('ba.isActive = :isActive', { isActive: true });
    } else if (query.isActive !== undefined) {
      queryBuilder.andWhere('ba.isActive = :isActive', { isActive: query.isActive });
    }

    // Ordenar: primero default, luego por sortOrder, luego por nombre
    queryBuilder.orderBy('ba.isDefault', 'DESC');
    queryBuilder.addOrderBy('ba.sortOrder', 'ASC');
    queryBuilder.addOrderBy('ba.name', 'ASC');

    return await queryBuilder.getMany();
  }

  /**
   * Obtener una cuenta bancaria por ID
   */
  async findOne(id: string): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const bankAccount = await this.bankAccountRepository.findOne({
      where: { id, organizationId: tenantId },
    });

    if (!bankAccount) {
      throw new NotFoundException(`Cuenta bancaria con ID ${id} no encontrada`);
    }

    return bankAccount;
  }

  /**
   * Actualizar una cuenta bancaria
   */
  async update(
    id: string,
    updateDto: UpdateBankAccountDto,
    updatedById?: string,
  ): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const bankAccount = await this.findOne(id);

    // Validar unicidad: combinación banco + número de cuenta (si se está cambiando alguno)
    const newName = updateDto.name ?? bankAccount.name;
    const newAccountNumber = updateDto.accountNumber ?? bankAccount.accountNumber;
    const nameChanged = updateDto.name && updateDto.name.toLowerCase() !== bankAccount.name.toLowerCase();
    const numberChanged = updateDto.accountNumber && updateDto.accountNumber !== bankAccount.accountNumber;

    if ((nameChanged || numberChanged) && newAccountNumber) {
      await this.validateUniqueBankAccountCombination(
        tenantId,
        newName,
        newAccountNumber,
        id,
      );
    }

    // Si se marca como default, quitar el flag de las demás
    if (updateDto.isDefault && !bankAccount.isDefault) {
      await this.clearDefaultFlag(tenantId);
    }

    // Actualizar campos
    Object.assign(bankAccount, {
      ...updateDto,
      updatedById,
    });

    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Eliminar (soft delete) una cuenta bancaria
   */
  async remove(id: string): Promise<void> {
    const bankAccount = await this.findOne(id);

    // Si era la cuenta default, asignar otra como default
    if (bankAccount.isDefault) {
      const tenantId = this.tenantAwareService.getTenantId();
      await this.bankAccountRepository.softDelete(id);

      // Buscar otra cuenta activa para hacerla default
      const anotherAccount = await this.bankAccountRepository.findOne({
        where: { organizationId: tenantId, isActive: true },
        order: { sortOrder: 'ASC' },
      });

      if (anotherAccount) {
        anotherAccount.isDefault = true;
        await this.bankAccountRepository.save(anotherAccount);
      }
    } else {
      await this.bankAccountRepository.softDelete(id);
    }
  }

  /**
   * Establecer una cuenta como predeterminada
   */
  async setDefault(id: string): Promise<BankAccount> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const bankAccount = await this.findOne(id);

    if (!bankAccount.isActive) {
      throw new BadRequestException(
        'No se puede establecer como predeterminada una cuenta inactiva',
      );
    }

    // Quitar default de las demás
    await this.clearDefaultFlag(tenantId);

    // Establecer como default
    bankAccount.isDefault = true;
    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Activar/desactivar una cuenta
   */
  async toggleActive(id: string): Promise<BankAccount> {
    const bankAccount = await this.findOne(id);

    // Si es la cuenta default y se va a desactivar, no permitir
    if (bankAccount.isDefault && bankAccount.isActive) {
      throw new BadRequestException(
        'No se puede desactivar la cuenta predeterminada. Primero establece otra cuenta como predeterminada.',
      );
    }

    bankAccount.isActive = !bankAccount.isActive;
    return await this.bankAccountRepository.save(bankAccount);
  }

  /**
   * Obtener la cuenta predeterminada del tenant
   */
  async getDefault(): Promise<BankAccount | null> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return await this.bankAccountRepository.findOne({
      where: { organizationId: tenantId, isDefault: true, isActive: true },
    });
  }

  /**
   * Obtener cuentas activas del tenant (para selects/dropdowns)
   */
  async getActiveAccounts(): Promise<BankAccount[]> {
    return this.findAll({ isActive: true });
  }

  /**
   * Actualizar el saldo de una cuenta bancaria
   * @param accountId - ID de la cuenta
   * @param amount - Monto a agregar (positivo) o restar (negativo)
   * @param operation - 'add' para sumar, 'subtract' para restar
   */
  async updateBalance(
    accountId: string,
    amount: number,
    operation: 'add' | 'subtract' = 'add',
  ): Promise<BankAccount> {
    const account = await this.findOne(accountId);

    const currentBalance = Number(account.currentBalance) || 0;
    const adjustedAmount = operation === 'subtract' ? -amount : amount;
    const newBalance = currentBalance + adjustedAmount;

    account.currentBalance = Math.round(newBalance * 100) / 100;

    console.log(`💰 Actualizando saldo de cuenta "${account.name}":
      - Saldo anterior: $${currentBalance.toLocaleString()}
      - Operación: ${operation} $${amount.toLocaleString()}
      - Nuevo saldo: $${account.currentBalance.toLocaleString()}`);

    return await this.bankAccountRepository.save(account);
  }

  /**
   * Actualizar saldo de una cuenta + registrar movement auditable.
   *
   * Reemplaza el viejo `updateBalanceById` que solo movía el saldo sin
   * historial. Ahora cada llamada genera un BankAccountMovement con el
   * `type` apropiado (default ADJUSTMENT) y un snapshot de balanceAfter.
   *
   * Mantiene la firma original (3 parámetros) para no romper callers, y
   * acepta parámetros opcionales para clasificar el movement correctamente.
   *
   * - amount: positivo suma al saldo, negativo resta.
   * - type: por defecto ADJUSTMENT. Pasar el correspondiente cuando viene
   *   de un módulo (INVOICE_PAYMENT, CREDIT_PAYMENT, EXPENSE_PAYMENT, REFUND).
   */
  async updateBalanceById(
    accountId: string,
    amount: number,
    organizationId: string,
    options?: {
      type?: BankAccountMovementType;
      description?: string;
      referenceType?: string;
      referenceId?: string;
      createdById?: string;
      manager?: EntityManager;
      allowOverdraft?: boolean;
    },
  ): Promise<void> {
    if (amount === 0) return;
    const type = options?.type ?? BankAccountMovementType.ADJUSTMENT;
    // El monto siempre se pasa positivo a recordMovement; el signo lo
    // determina el tipo. Cuando llega negativo (resta), interpretamos
    // como salida y usamos su valor absoluto.
    const isNegativeAmount = amount < 0;
    const absAmount = Math.abs(amount);
    // Si type es ADJUSTMENT, indicar dirección via metadata.
    const metadata =
      type === BankAccountMovementType.ADJUSTMENT
        ? { direction: isNegativeAmount ? 'subtract' : 'add' }
        : undefined;

    await this.recordMovement({
      bankAccountId: accountId,
      type,
      amount: absAmount,
      description: options?.description,
      referenceType: options?.referenceType,
      referenceId: options?.referenceId,
      metadata,
      organizationId,
      createdById: options?.createdById,
      manager: options?.manager,
      // Para mantener compatibilidad con flujos legacy que cobraban siempre
      // sin validar saldo (ej: invoice payment puede meter negativo en ajustes
      // contables), permitimos sobregiro si NO es WITHDRAWAL ni EXPENSE_PAYMENT.
      allowOverdraft:
        options?.allowOverdraft ??
        (type !== BankAccountMovementType.WITHDRAWAL &&
          type !== BankAccountMovementType.EXPENSE_PAYMENT),
    });
  }

  /**
   * Obtener cuenta por ID sin validación de tenant (para uso interno en transacciones)
   */
  async findByIdInternal(accountId: string): Promise<BankAccount | null> {
    return await this.bankAccountRepository.findOne({
      where: { id: accountId },
    });
  }

  /**
   * Quitar el flag isDefault de todas las cuentas del tenant
   */
  private async clearDefaultFlag(organizationId: string): Promise<void> {
    await this.bankAccountRepository
      .createQueryBuilder()
      .update(BankAccount)
      .set({ isDefault: false })
      .where('organizationId = :organizationId', { organizationId })
      .execute();
  }

  /**
   * Validar que la combinación (nombre banco + número cuenta) sea única para el tenant
   * - Permite múltiples cuentas del mismo banco con diferentes números
   * - Permite el mismo número en diferentes bancos
   * - NO permite: mismo banco + mismo número
   * @param organizationId - ID de la organización
   * @param bankName - Nombre del banco (case-insensitive)
   * @param accountNumber - Número de cuenta
   * @param excludeId - ID de cuenta a excluir (para updates)
   */
  private async validateUniqueBankAccountCombination(
    organizationId: string,
    bankName: string,
    accountNumber: string,
    excludeId?: string,
  ): Promise<void> {
    const queryBuilder = this.bankAccountRepository
      .createQueryBuilder('ba')
      .where('ba.organizationId = :organizationId', { organizationId })
      .andWhere('LOWER(ba.name) = LOWER(:bankName)', { bankName: bankName.trim() })
      .andWhere('ba.accountNumber = :accountNumber', { accountNumber });

    // Si es un update, excluir la cuenta actual
    if (excludeId) {
      queryBuilder.andWhere('ba.id != :excludeId', { excludeId });
    }

    const existingAccount = await queryBuilder.getOne();

    if (existingAccount) {
      throw new BadRequestException(
        `Ya existe una cuenta "${bankName}" con el número "${accountNumber}" en tu organización`,
      );
    }
  }

  /**
   * Obtener resumen de cuentas bancarias con totales de pagos recibidos
   * @param organizationId - ID de la organización (requerido)
   * @param startDate - Fecha de inicio para el período (opcional)
   * @param endDate - Fecha de fin para el período (opcional)
   */
  async getSummary(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<BankAccountSummary[]> {
    if (!organizationId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // TZ de la organización — necesaria para convertir el rango local del
    // usuario a timestamps UTC y poder filtrar paymentDate correctamente.
    const [orgRow] = await this.em.query(
      'SELECT timezone FROM organizations WHERE id = $1',
      [organizationId],
    );
    const orgTimezone: string = orgRow?.timezone || 'America/New_York';

    // Rango UTC derivado del rango local del tenant (si viene).
    let startUtc: Date | null = null;
    let endUtcExclusive: Date | null = null;
    if (startDate && endDate) {
      startUtc = toUtcAtTenantMidnight(startDate, orgTimezone);
      endUtcExclusive = addOneDay(toUtcAtTenantMidnight(endDate, orgTimezone));
    }

    const accounts = await this.bankAccountRepository.find({
      where: { organizationId, isActive: true },
      order: { isDefault: 'DESC', sortOrder: 'ASC', name: 'ASC' },
    });

    const summaries: BankAccountSummary[] = [];

    for (const account of accounts) {
      // Todas las sub-queries de la cuenta en paralelo.
      const [
        totalPaymentsResult,
        periodPaymentsResult,
        totalCreditsResult,
        periodCreditsResult,
      ] = await Promise.all([
        // Histórico: pagos de facturas
        this.paymentRepository
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.amount), 0)', 'total')
          .addSelect('COUNT(p.id)', 'count')
          .where('p.bankAccountId = :accountId', { accountId: account.id })
          .andWhere('p.organizationId = :organizationId', { organizationId })
          .getRawOne<{ total: string; count: string }>(),

        // Período: pagos cuya paymentDate cae en el rango (TZ-aware).
        // Antes filtraba por i.date (accrual-by-invoice) lo cual no reflejaba
        // cobros de hoy sobre facturas viejas. Ahora es cash basis real.
        startUtc && endUtcExclusive
          ? this.paymentRepository
              .createQueryBuilder('p')
              .select('COALESCE(SUM(p.amount), 0)', 'total')
              .addSelect('COUNT(p.id)', 'count')
              .where('p.bankAccountId = :accountId', { accountId: account.id })
              .andWhere('p.organizationId = :organizationId', { organizationId })
              .andWhere('p.paymentDate >= :startUtc', { startUtc })
              .andWhere('p.paymentDate <  :endUtcExclusive', { endUtcExclusive })
              .getRawOne<{ total: string; count: string }>()
          : Promise.resolve(null),

        // Histórico: abonos a préstamos directos (créditos sin factura).
        // IMPORTANTE: filtramos por cc.invoice_id IS NULL para evitar doble conteo.
        // Cuando se abona a una factura-crédito, el backend crea registros
        // sincronizados en `payments` Y `credit_payments` (ver customer-credits.service
        // y invoices.service). Si sumáramos todos los credit_payments, contaríamos
        // dos veces los abonos a facturas-crédito. Solo los préstamos directos
        // (invoice_id NULL) NO tienen contraparte en payments.
        this.creditPaymentRepository
          .createQueryBuilder('cp')
          .innerJoin('cp.credit', 'cc')
          .select('COALESCE(SUM(cp.amount), 0)', 'total')
          .addSelect('COUNT(cp.id)', 'count')
          .where('cp.bankAccountId = :accountId', { accountId: account.id })
          .andWhere('cp.organizationId = :organizationId', { organizationId })
          .andWhere('cc.invoiceId IS NULL')
          .getRawOne<{ total: string; count: string }>()
          .catch(() => null),

        // Período: abonos a préstamos directos en el rango (TZ-aware).
        startUtc && endUtcExclusive
          ? this.creditPaymentRepository
              .createQueryBuilder('cp')
              .innerJoin('cp.credit', 'cc')
              .select('COALESCE(SUM(cp.amount), 0)', 'total')
              .addSelect('COUNT(cp.id)', 'count')
              .where('cp.bankAccountId = :accountId', { accountId: account.id })
              .andWhere('cp.organizationId = :organizationId', { organizationId })
              .andWhere('cc.invoiceId IS NULL')
              .andWhere('cp.paymentDate >= :startUtc', { startUtc })
              .andWhere('cp.paymentDate <  :endUtcExclusive', { endUtcExclusive })
              .getRawOne<{ total: string; count: string }>()
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      summaries.push({
        id: account.id,
        name: account.name,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        type: account.type,
        icon: account.icon,
        currentBalance: Number(account.currentBalance) || 0,

        totalReceived: parseFloat(totalPaymentsResult?.total || '0'),
        paymentCount: parseInt(totalPaymentsResult?.count || '0', 10),
        creditPaymentTotal: parseFloat(totalCreditsResult?.total || '0'),
        creditPaymentCount: parseInt(totalCreditsResult?.count || '0', 10),

        totalReceivedPeriod: parseFloat(periodPaymentsResult?.total || '0'),
        paymentCountPeriod: parseInt(periodPaymentsResult?.count || '0', 10),
        creditPaymentTotalPeriod: parseFloat(periodCreditsResult?.total || '0'),
        creditPaymentCountPeriod: parseInt(periodCreditsResult?.count || '0', 10),

        isDefault: account.isDefault,
        isActive: account.isActive,
      });
    }

    return summaries;
  }

  /**
   * Obtener todas las transacciones de una cuenta bancaria con paginación y filtros
   * @param accountId - ID de la cuenta bancaria
   * @param query - Filtros de búsqueda, fecha y paginación
   */
  async getTransactions(
    accountId: string,
    query: any,
  ): Promise<any> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Verificar que la cuenta existe y pertenece al tenant
    const account = await this.findOne(accountId);

    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(parseInt(query.limit, 10) || 50, 100);
    const skip = (page - 1) * limit;

    // Filtros de fecha
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    // Query para obtener pagos de facturas
    const paymentsQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .where('payment.bankAccountId = :accountId', { accountId })
      .andWhere('payment.organizationId = :organizationId', {
        organizationId: tenantId,
      });

    // Aplicar filtros de fecha si existen
    if (startDate) {
      paymentsQuery.andWhere('payment.paymentDate >= :startDate', {
        startDate,
      });
    }
    if (endDate) {
      paymentsQuery.andWhere('payment.paymentDate <= :endDate', { endDate });
    }

    // Aplicar búsqueda por cliente o número de factura
    if (query.search && query.search.trim()) {
      paymentsQuery.andWhere(
        '(LOWER(customer.name) LIKE LOWER(:search) OR LOWER(invoice.invoiceNumber) LIKE LOWER(:search))',
        { search: `%${query.search.trim()}%` },
      );
    }

    // Contar total de transacciones
    const totalPayments = await paymentsQuery.getCount();

    // Query para obtener pagos de créditos
    let totalCredits = 0;
    let creditPayments: any[] = [];
    try {
      const creditsQuery = this.creditPaymentRepository
        .createQueryBuilder('cp')
        .leftJoinAndSelect('cp.customer', 'customer')
        .where('cp.bankAccountId = :accountId', { accountId })
        .andWhere('cp.organizationId = :organizationId', {
          organizationId: tenantId,
        });

      if (startDate) {
        creditsQuery.andWhere('cp.paymentDate >= :startDate', { startDate });
      }
      if (endDate) {
        creditsQuery.andWhere('cp.paymentDate <= :endDate', { endDate });
      }

      if (query.search && query.search.trim()) {
        creditsQuery.andWhere('LOWER(customer.name) LIKE LOWER(:search)', {
          search: `%${query.search.trim()}%`,
        });
      }

      totalCredits = await creditsQuery.getCount();
      creditPayments = await creditsQuery
        .orderBy('cp.paymentDate', 'DESC')
        .limit(limit)
        .skip(skip)
        .getMany();
    } catch (e) {
      console.log('Credit payments query error (ignored):', e.message);
    }

    // Obtener pagos de facturas con paginación
    const payments = await paymentsQuery
      .orderBy('payment.paymentDate', 'DESC')
      .addOrderBy('payment.createdAt', 'DESC')
      .limit(limit)
      .skip(skip)
      .getMany();

    // Combinar y formatear transacciones
    const transactions: any[] = [];

    // Agregar pagos de facturas
    for (const payment of payments) {
      transactions.push({
        id: payment.id,
        date: payment.paymentDate,
        type: 'invoice_payment',
        amount: Number(payment.amount),
        customer: payment.invoice?.customer
          ? {
              id: payment.invoice.customer.id,
              name: `${payment.invoice.customer.firstName} ${payment.invoice.customer.lastName}`.trim(),
              email: payment.invoice.customer.email,
              phone: payment.invoice.customer.phone,
            }
          : null,
        invoice: payment.invoice
          ? {
              id: payment.invoice.id,
              invoiceNumber: payment.invoice.number,
              total: Number(payment.invoice.total),
            }
          : null,
        paymentMethod: payment.paymentMethod,
        description: `Pago de factura ${payment.invoice?.number || ''}`,
        notes: payment.notes,
      });
    }

    // Agregar pagos de créditos
    for (const creditPayment of creditPayments) {
      transactions.push({
        id: creditPayment.id,
        date: creditPayment.paymentDate,
        type: 'credit_payment',
        amount: Number(creditPayment.amount),
        customer: creditPayment.customer
          ? {
              id: creditPayment.customer.id,
              name: `${creditPayment.customer.firstName} ${creditPayment.customer.lastName}`.trim(),
              email: creditPayment.customer.email,
              phone: creditPayment.customer.phone,
            }
          : null,
        invoice: null,
        paymentMethod: creditPayment.paymentMethod || 'credit',
        description: `Pago de crédito`,
        notes: creditPayment.notes,
      });
    }

    // Ordenar por fecha descendente
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Calcular totales para el resumen
    const totalTransactions = totalPayments + totalCredits;
    const totalIncome = transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    const averageTransaction =
      transactions.length > 0 ? totalIncome / transactions.length : 0;

    // Construir respuesta
    return {
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        currentBalance: Number(account.currentBalance) || 0,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
      },
      transactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        totalPages: Math.ceil(totalTransactions / limit),
      },
      summary: {
        totalIncome,
        transactionCount: totalTransactions,
        periodStart: startDate,
        periodEnd: endDate,
        averageTransaction,
      },
    };
  }

  // ==================== MOVEMENTS API ====================

  /**
   * Núcleo de la auditoría de saldos: registra UN movement y actualiza
   * el balance de la cuenta en una sola transacción atómica.
   *
   * Validaciones:
   *   - Monto > 0 (el signo lo determina el tipo).
   *   - Si es outflow y `allowOverdraft=false` (default), valida que el
   *     saldo no quede negativo.
   *
   * Use desde TODOS los puntos donde antes se llamaba updateBalance/
   * updateBalanceById, para garantizar que cada cambio de saldo deja
   * registro auditable.
   */
  async recordMovement(params: {
    bankAccountId: string;
    type: BankAccountMovementType;
    amount: number;
    movementDate?: Date;
    description?: string;
    referenceType?: string;
    referenceId?: string;
    counterpartyAccountId?: string;
    counterpartyMovementId?: string;
    metadata?: Record<string, any>;
    organizationId: string;
    createdById?: string;
    /** Si es true, no valida saldo negativo. Default: false. */
    allowOverdraft?: boolean;
    /**
     * Permite ejecutar dentro de una transacción externa para garantizar
     * atomicidad con otras operaciones (ej: registrar pago + movement).
     * Si no se pasa, se usa una transacción interna.
     */
    manager?: EntityManager;
  }): Promise<BankAccountMovement> {
    if (!params.amount || params.amount <= 0) {
      throw new BadRequestException(
        'El monto del movimiento debe ser mayor a cero',
      );
    }

    const exec = async (mgr: EntityManager): Promise<BankAccountMovement> => {
      // 1. Lock pesimista de la cuenta para evitar races
      const account = await mgr
        .getRepository(BankAccount)
        .createQueryBuilder('ba')
        .setLock('pessimistic_write')
        .where('ba.id = :id', { id: params.bankAccountId })
        .andWhere('ba.organizationId = :org', {
          org: params.organizationId,
        })
        .getOne();

      if (!account) {
        throw new NotFoundException('Cuenta bancaria no encontrada');
      }

      const previousBalance = Number(account.currentBalance) || 0;
      const isInflow = BankAccountMovement.isInflow(params.type);
      const isOutflow = BankAccountMovement.isOutflow(params.type);
      // ADJUSTMENT y otros pueden venir con signo dirigido por metadata; por
      // simplicidad: si no es inflow ni outflow conocido, asumir que el
      // monto es la entrada literal (positivo suma).
      let delta = params.amount;
      if (isOutflow) delta = -params.amount;
      else if (!isInflow) {
        // Tipo desconocido o ADJUSTMENT: leer signo de metadata.direction si
        // se especifica; default sumar.
        if (params.metadata?.direction === 'subtract') {
          delta = -params.amount;
        }
      }

      const newBalance = previousBalance + delta;
      const allowOverdraft = params.allowOverdraft ?? false;
      if (!allowOverdraft && newBalance < 0) {
        throw new BadRequestException(
          `Saldo insuficiente en "${account.name}". Saldo actual: ` +
            `$${previousBalance.toLocaleString()}, intenta retirar: ` +
            `$${params.amount.toLocaleString()}`,
        );
      }

      // 2. Actualizar saldo
      account.currentBalance = Math.round(newBalance * 100) / 100;
      await mgr.getRepository(BankAccount).save(account);

      // 3. Crear movement con snapshot del saldo
      const movement = mgr.getRepository(BankAccountMovement).create({
        bankAccountId: params.bankAccountId,
        type: params.type,
        amount: params.amount,
        balanceAfter: account.currentBalance,
        movementDate: params.movementDate ?? new Date(),
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        counterpartyAccountId: params.counterpartyAccountId,
        counterpartyMovementId: params.counterpartyMovementId,
        metadata: params.metadata,
        organizationId: params.organizationId,
        createdById: params.createdById,
      });
      const saved = await mgr.getRepository(BankAccountMovement).save(movement);

      console.log(
        `📒 Movement ${params.type} $${params.amount.toLocaleString()} → ` +
          `${account.name}: $${previousBalance.toLocaleString()} → ` +
          `$${account.currentBalance.toLocaleString()}`,
      );

      return saved;
    };

    if (params.manager) {
      return await exec(params.manager);
    }
    return await this.em.transaction(exec);
  }

  /**
   * Depósito manual del usuario (entra plata a la cuenta sin venir de una
   * factura/abono).
   */
  async depositManual(params: {
    bankAccountId: string;
    amount: number;
    description?: string;
    movementDate?: Date;
    organizationId: string;
    createdById?: string;
  }): Promise<BankAccountMovement> {
    return this.recordMovement({
      ...params,
      type: BankAccountMovementType.DEPOSIT,
      description: params.description ?? 'Depósito manual',
    });
  }

  /**
   * Retiro manual del usuario (sale plata sin gasto formal asociado).
   */
  async withdrawManual(params: {
    bankAccountId: string;
    amount: number;
    description?: string;
    movementDate?: Date;
    organizationId: string;
    createdById?: string;
  }): Promise<BankAccountMovement> {
    return this.recordMovement({
      ...params,
      type: BankAccountMovementType.WITHDRAWAL,
      description: params.description ?? 'Retiro manual',
    });
  }

  /**
   * Transferencia entre dos cuentas. Genera 2 movements atómicos
   * (transfer_out de origen + transfer_in de destino) cruzados por
   * `counterpartyMovementId`. Si una mitad falla, ninguna se aplica.
   */
  async transferBetweenAccounts(params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    movementDate?: Date;
    organizationId: string;
    createdById?: string;
  }): Promise<{
    outMovement: BankAccountMovement;
    inMovement: BankAccountMovement;
  }> {
    if (params.fromAccountId === params.toAccountId) {
      throw new BadRequestException(
        'No se puede transferir a la misma cuenta',
      );
    }
    if (!params.amount || params.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    return await this.em.transaction(async (mgr) => {
      const out = await this.recordMovement({
        bankAccountId: params.fromAccountId,
        type: BankAccountMovementType.TRANSFER_OUT,
        amount: params.amount,
        movementDate: params.movementDate,
        description:
            params.description ?? 'Transferencia entre cuentas (salida)',
        counterpartyAccountId: params.toAccountId,
        organizationId: params.organizationId,
        createdById: params.createdById,
        manager: mgr,
      });
      const inn = await this.recordMovement({
        bankAccountId: params.toAccountId,
        type: BankAccountMovementType.TRANSFER_IN,
        amount: params.amount,
        movementDate: params.movementDate,
        description:
            params.description ?? 'Transferencia entre cuentas (entrada)',
        counterpartyAccountId: params.fromAccountId,
        counterpartyMovementId: out.id,
        organizationId: params.organizationId,
        createdById: params.createdById,
        manager: mgr,
      });
      // Cerrar el ciclo: out apunta al inn
      out.counterpartyMovementId = inn.id;
      await mgr.getRepository(BankAccountMovement).save(out);
      return { outMovement: out, inMovement: inn };
    });
  }

  /**
   * Lista los movements REALES (de la nueva tabla) de una cuenta para un
   * período. Reemplaza el cálculo on-the-fly de getTransactions.
   */
  async listMovements(params: {
    bankAccountId: string;
    organizationId: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    items: BankAccountMovement[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);

    const qb = this.movementRepository
      .createQueryBuilder('m')
      .where('m.bankAccountId = :acc', { acc: params.bankAccountId })
      .andWhere('m.organizationId = :org', {
        org: params.organizationId,
      })
      .orderBy('m.movementDate', 'DESC')
      .addOrderBy('m.createdAt', 'DESC');

    if (params.startDate) {
      qb.andWhere('m.movementDate >= :start', { start: params.startDate });
    }
    if (params.endDate) {
      qb.andWhere('m.movementDate <= :end', { end: params.endDate });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total, page, limit };
  }
}
