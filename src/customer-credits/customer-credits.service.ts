// src/customer-credits/customer-credits.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, IsNull, Not } from 'typeorm';
import { CustomerCredit, CreditStatus } from './entities/customer-credit.entity';
import { CreditPayment } from './entities/credit-payment.entity';
import { CreditTransaction, CreditTransactionType } from './entities/credit-transaction.entity';
import { Invoice, InvoiceStatus, PaymentMethod } from '../invoices/entities/invoice.entity';
import { Payment } from '../invoices/entities/payment.entity';

// Prefijos para identificar pagos sincronizados y evitar loops
const SYNC_FROM_CREDIT_PREFIX = 'SYNC-CRD-';
const SYNC_FROM_INVOICE_PREFIX = 'SYNC-INV-';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { CustomersService } from '../customers/customers.service';
import { ClientBalanceService } from './client-balance.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { Organization } from '../organizations/entities/organization.entity';
import {
  CreateCustomerCreditDto,
  AddCreditPaymentDto,
  CustomerCreditQueryDto,
} from './dto';

/**
 * DTO para agregar monto a un crédito existente
 */
export interface AddAmountToCreditDto {
  amount: number;
  description: string;
}

@Injectable()
export class CustomerCreditsService {
  constructor(
    @InjectRepository(CustomerCredit)
    private readonly creditRepository: Repository<CustomerCredit>,
    @InjectRepository(CreditPayment)
    private readonly paymentRepository: Repository<CreditPayment>,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly tenantAwareService: TenantAwareService,
    private readonly customersService: CustomersService,
    @Inject(forwardRef(() => ClientBalanceService))
    private readonly clientBalanceService: ClientBalanceService,
    private readonly cashRegisterService: CashRegisterService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Validar que haya caja abierta cuando se paga un crédito en efectivo.
   * Réplica del flujo que ya tienen `invoices.service.validateCashRegisterIfNeeded`
   * y `expenses.service`: si el tenant tiene desactivado el módulo
   * (`organization.settings.cashRegisterEnabled = false`), NO valida.
   * Si está activo y el método es cash, exige caja abierta.
   *
   * Antes este flujo no existía para créditos: un cliente podía pagar un
   * crédito en efectivo aunque la caja estuviera cerrada, y ese efectivo
   * no quedaba contabilizado en el turno. Ahora se bloquea explícitamente.
   */
  private async validateCashRegisterIfNeeded(
    paymentMethod: PaymentMethod,
    organizationId: string,
  ): Promise<void> {
    if (paymentMethod !== PaymentMethod.CASH) return;

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id', 'settings'],
    });
    const cashRegisterEnabled =
      (organization?.settings as any)?.cashRegisterEnabled ?? true;
    if (!cashRegisterEnabled) return;

    const openRegister =
      await this.cashRegisterService.getOpenCashRegister(organizationId);
    if (!openRegister) {
      throw new BadRequestException(
        'No hay una caja abierta. Para registrar pagos en efectivo, ' +
          'abre la caja registradora primero (declarando el saldo inicial ' +
          'del turno).',
      );
    }
  }

  /**
   * Crear un nuevo crédito de cliente
   */
  async create(
    dto: CreateCustomerCreditDto,
    createdById: string,
  ): Promise<CustomerCredit> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Verificar que el cliente existe
    const customer = await this.customersService.findOne(dto.customerId);
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // VALIDACIÓN: No permitir nuevo crédito directo si hay uno pendiente
    // Solo aplica para créditos directos (sin invoiceId), los de facturas son automáticos
    if (!dto.invoiceId) {
      const pendingCredit = await this.creditRepository.findOne({
        where: {
          customerId: dto.customerId,
          organizationId: tenantId,
          invoiceId: IsNull(), // Solo créditos directos (no de facturas)
          status: Not(CreditStatus.PAID),
        },
      });

      if (pendingCredit && pendingCredit.status !== CreditStatus.CANCELLED) {
        throw new BadRequestException(
          `El cliente ya tiene un crédito pendiente de $${pendingCredit.balanceDue.toLocaleString()}. ` +
          `Debe cancelar o pagar el crédito existente antes de crear uno nuevo.`
        );
      }
    }

    console.log(`📝 [Credits] Creando crédito de $${dto.originalAmount} para cliente ${customer.firstName}`);

    return this.dataSource.transaction(async (manager) => {
      // 1. Crear el crédito
      const credit = manager.create(CustomerCredit, {
        originalAmount: dto.originalAmount,
        paidAmount: 0,
        balanceDue: dto.originalAmount,
        status: CreditStatus.PENDING,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        description: dto.description,
        notes: dto.notes,
        customerId: dto.customerId,
        invoiceId: dto.invoiceId || null,
        organizationId: tenantId,
        createdById,
      });

      const savedCredit = await manager.save(CustomerCredit, credit);
      console.log(`✅ [Credits] Crédito creado con ID: ${savedCredit.id}`);

      // 2. Crear transacción inicial (CHARGE)
      const initialTransaction = manager.create(CreditTransaction, {
        creditId: savedCredit.id,
        type: CreditTransactionType.CHARGE,
        amount: dto.originalAmount,
        description: dto.description || 'Crédito inicial',
        balanceAfter: dto.originalAmount,
        organizationId: tenantId,
        createdById,
      });
      await manager.save(CreditTransaction, initialTransaction);

      // 3. Actualizar balance del cliente (deuda)
      await this.customersService.updateBalance(
        dto.customerId,
        dto.originalAmount,
        'add',
      );

      return savedCredit;
    }).then(async (savedCredit) => {
      // 4. AUTOMÁTICO: Verificar y aplicar saldo a favor si el cliente tiene disponible
      // Por defecto siempre aplica, a menos que se indique skipAutoBalance: true
      if (!dto.skipAutoBalance) {
        console.log(`💰 [Credits] Verificando saldo a favor para aplicar automáticamente...`);

        try {
          const clientBalance = await this.clientBalanceService.getClientBalance(dto.customerId);

          if (clientBalance && Number(clientBalance.balance) > 0) {
            const availableBalance = Number(clientBalance.balance);
            const creditAmount = Number(savedCredit.balanceDue);
            const balanceToUse = Math.min(availableBalance, creditAmount);

            console.log(`💰 [Credits] Saldo disponible: $${availableBalance}, Usando: $${balanceToUse}`);

            if (balanceToUse > 0) {
              // Usar el saldo a favor
              await this.clientBalanceService.useBalance(
                {
                  clientId: dto.customerId,
                  amount: balanceToUse,
                  description: `Aplicado al crédito #${savedCredit.id.substring(0, 8)}`,
                  relatedCreditId: savedCredit.id,
                },
                createdById,
              );

              // Crear pago con el saldo usado
              const balancePayment = this.paymentRepository.create({
                amount: balanceToUse,
                paymentMethod: 'saldo_favor',
                paymentDate: new Date(),
                notes: 'Abono de saldo a favor',
                creditId: savedCredit.id,
                organizationId: tenantId,
                createdById,
              });
              await this.paymentRepository.save(balancePayment);

              // Registrar transacción de pago
              const paymentTransaction = this.transactionRepository.create({
                creditId: savedCredit.id,
                type: CreditTransactionType.BALANCE_USED,
                amount: balanceToUse,
                description: 'Abono de saldo a favor',
                balanceAfter: creditAmount - balanceToUse,
                organizationId: tenantId,
                createdById,
              });
              await this.transactionRepository.save(paymentTransaction);

              // Actualizar el crédito
              const newPaidAmount = balanceToUse;
              const newBalanceDue = creditAmount - balanceToUse;
              const newStatus = newBalanceDue <= 0 ? CreditStatus.PAID : CreditStatus.PARTIALLY_PAID;

              await this.creditRepository.update(
                { id: savedCredit.id },
                {
                  paidAmount: newPaidAmount,
                  balanceDue: Math.max(0, newBalanceDue),
                  status: newStatus,
                },
              );

              // Actualizar balance del cliente
              await this.customersService.updateBalance(
                dto.customerId,
                balanceToUse,
                'subtract',
              );

              // SINCRONIZACIÓN: Actualizar factura asociada si existe
              if (dto.invoiceId) {
                try {
                  const invoice = await this.invoiceRepository.findOne({
                    where: { id: dto.invoiceId },
                  });

                  if (invoice) {
                    const invoiceNewBalanceDue = Math.max(0, newBalanceDue);
                    const invoiceNewPaidAmount = Math.max(0, Number(invoice.total) - invoiceNewBalanceDue);

                    let invoiceNewStatus: InvoiceStatus;
                    if (invoiceNewBalanceDue <= 0) {
                      invoiceNewStatus = InvoiceStatus.PAID;
                    } else if (invoiceNewPaidAmount > 0) {
                      invoiceNewStatus = InvoiceStatus.PARTIALLY_PAID;
                    } else {
                      invoiceNewStatus = invoice.status;
                    }

                    await this.invoiceRepository.update(
                      { id: dto.invoiceId },
                      {
                        paidAmount: invoiceNewPaidAmount,
                        balanceDue: invoiceNewBalanceDue,
                        status: invoiceNewStatus,
                      },
                    );

                    console.log(`🔄 [Credits→Invoice] Factura ${invoice.number} sincronizada tras usar saldo a favor`);
                  }
                } catch (syncError) {
                  console.error(`❌ [Credits] Error al sincronizar factura:`, syncError.message);
                }
              }

              console.log(`✅ [Credits] Saldo a favor aplicado: $${balanceToUse}`);
            }
          }
        } catch (error) {
          console.error(`❌ [Credits] Error al aplicar saldo a favor:`, error.message);
          // No lanzar error, el crédito ya fue creado
        }
      }

      return this.findOne(savedCredit.id);
    });
  }

  /**
   * Obtener todos los créditos con filtros
   */
  async findAll(query: CustomerCreditQueryDto): Promise<CustomerCredit[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const qb = this.creditRepository
      .createQueryBuilder('credit')
      .leftJoinAndSelect('credit.customer', 'customer')
      .leftJoinAndSelect('credit.invoice', 'invoice')
      .leftJoinAndSelect('credit.createdBy', 'createdBy')
      .where('credit.organizationId = :tenantId', { tenantId })
      .andWhere('credit.deletedAt IS NULL');

    if (query.customerId) {
      qb.andWhere('credit.customerId = :customerId', {
        customerId: query.customerId,
      });
    }

    if (query.status) {
      qb.andWhere('credit.status = :status', { status: query.status });
    }

    if (!query.includeCancelled) {
      qb.andWhere('credit.status != :cancelledStatus', {
        cancelledStatus: CreditStatus.CANCELLED,
      });
    }

    if (query.overdueOnly) {
      qb.andWhere('credit.dueDate < :today', { today: new Date() })
        .andWhere('credit.status NOT IN (:...completedStatuses)', {
          completedStatuses: [CreditStatus.PAID, CreditStatus.CANCELLED],
        });
    }

    if (query.startDate) {
      qb.andWhere('credit.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      qb.andWhere('credit.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    qb.orderBy('credit.createdAt', 'DESC');

    return qb.getMany();
  }

  /**
   * Obtener créditos de un cliente específico
   */
  async findByCustomer(customerId: string): Promise<CustomerCredit[]> {
    return this.findAll({ customerId });
  }

  /**
   * Obtener créditos pendientes de un cliente
   */
  async findPendingByCustomer(customerId: string): Promise<CustomerCredit[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.creditRepository.find({
      where: {
        customerId,
        organizationId: tenantId,
        status: Not(CreditStatus.PAID),
        deletedAt: IsNull(),
      },
      relations: ['customer', 'invoice'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Obtener crédito directo (sin factura) pendiente de un cliente
   * Usado para determinar si se debe agregar monto a un crédito existente
   * @returns El crédito directo pendiente o null si no existe
   */
  async findPendingDirectCreditByCustomer(customerId: string): Promise<CustomerCredit | null> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.creditRepository.findOne({
      where: {
        customerId,
        organizationId: tenantId,
        invoiceId: IsNull(), // Sin factura asociada = crédito directo
        status: Not(CreditStatus.PAID),
        deletedAt: IsNull(),
      },
      relations: ['customer'],
      order: { createdAt: 'DESC' }, // El más reciente
    });
  }

  /**
   * Obtener un crédito por ID
   */
  async findOne(id: string): Promise<CustomerCredit> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const credit = await this.creditRepository.findOne({
      where: { id, organizationId: tenantId, deletedAt: IsNull() },
      relations: [
        'customer',
        'invoice',
        'invoice.items',
        'invoice.items.product',
        'createdBy',
        'payments',
        'payments.bankAccount',
      ],
    });

    if (!credit) {
      throw new NotFoundException('Crédito no encontrado');
    }

    // Cargar transacciones
    const transactions = await this.transactionRepository.find({
      where: { creditId: id },
      order: { createdAt: 'DESC' },
    });
    (credit as any).transactions = transactions;

    return credit;
  }

  /**
   * Agregar un abono al crédito
   * NUEVO: Permite sobrepagos que se convierten en saldo a favor
   */
  async addPayment(
    creditId: string,
    dto: AddCreditPaymentDto,
    createdById: string,
  ): Promise<{ credit: CustomerCredit; payment: CreditPayment }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // 🔒 PHASE 2: caja abierta requerida si el pago es en efectivo y el
    // tenant tiene el módulo activo. Bloqueo temprano para no encolar la
    // transacción y revertir después.
    await this.validateCashRegisterIfNeeded(dto.paymentMethod, tenantId);

    const credit = await this.findOne(creditId);

    if (credit.status === CreditStatus.PAID) {
      throw new BadRequestException('El crédito ya está pagado completamente');
    }

    if (credit.status === CreditStatus.CANCELLED) {
      throw new BadRequestException('No se puede abonar a un crédito cancelado');
    }

    const remainingAmount = Number(credit.balanceDue);
    const paymentAmount = Number(dto.amount);

    if (paymentAmount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero');
    }

    // Calcular sobrepago si existe
    let overpaymentAmount = 0;
    let effectivePaymentAmount = paymentAmount;

    if (paymentAmount > remainingAmount) {
      overpaymentAmount = paymentAmount - remainingAmount;
      effectivePaymentAmount = remainingAmount;
      console.log(`💰 [Credits] Sobrepago detectado: $${overpaymentAmount}`);
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Crear el pago
      const payment = manager.create(CreditPayment, {
        amount: paymentAmount,
        paymentMethod: dto.paymentMethod,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        reference: dto.reference,
        notes: dto.notes,
        creditId,
        bankAccountId: dto.bankAccountId || null,
        organizationId: tenantId,
        createdById,
      });

      const savedPayment = await manager.save(CreditPayment, payment);

      // 2. Calcular nuevo estado
      const newPaidAmount = credit.paidAmount + effectivePaymentAmount;
      const newBalanceDue = Math.max(0, credit.originalAmount - newPaidAmount);
      const newStatus = newBalanceDue <= 0 ? CreditStatus.PAID : CreditStatus.PARTIALLY_PAID;

      // 3. Actualizar el crédito
      await manager.update(CustomerCredit, { id: creditId }, {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
      });

      // 4. Registrar transacción de pago (incluye info de saldo generado si hay sobrepago)
      // Si hay sobrepago, agregamos la info en la descripción con formato detectable
      let paymentDescription = dto.notes || null;
      if (overpaymentAmount > 0) {
        const balanceInfo = `[SALDO_GENERADO:${overpaymentAmount}]`;
        paymentDescription = paymentDescription
          ? `${paymentDescription} ${balanceInfo}`
          : balanceInfo;
      }

      const paymentTransaction = manager.create(CreditTransaction, {
        creditId,
        type: CreditTransactionType.PAYMENT,
        amount: paymentAmount,
        description: paymentDescription,
        balanceAfter: newBalanceDue,
        paymentMethod: dto.paymentMethod,
        bankAccountId: dto.bankAccountId || null,
        organizationId: tenantId,
        createdById,
      });
      await manager.save(CreditTransaction, paymentTransaction);

      // 5. Actualizar balance del cliente
      await this.customersService.updateBalance(
        credit.customerId,
        effectivePaymentAmount,
        'subtract',
      );

      console.log(`💰 [Credits] Abono de $${paymentAmount}. Saldo: $${newBalanceDue}`);

      // 6. SINCRONIZACIÓN: Actualizar factura asociada si existe
      // IMPORTANTE: El crédito representa el saldo pendiente de la factura.
      // Por lo tanto, el balanceDue de la factura debe ser IGUAL al balanceDue del crédito.
      // NO debemos sumar el pago, sino sincronizar directamente el saldo.
      if (credit.invoiceId) {
        try {
          const invoice = await manager.findOne(Invoice, {
            where: { id: credit.invoiceId },
          });

          if (invoice) {
            // El saldo de la factura debe ser exactamente igual al saldo del crédito
            // porque el crédito representa la deuda pendiente de esa factura
            const invoiceNewBalanceDue = newBalanceDue; // Usar el nuevo saldo del crédito directamente
            const invoiceNewPaidAmount = Math.max(0, Number(invoice.total) - invoiceNewBalanceDue);

            let invoiceNewStatus: InvoiceStatus;
            if (invoiceNewBalanceDue <= 0) {
              invoiceNewStatus = InvoiceStatus.PAID;
            } else if (invoiceNewPaidAmount > 0) {
              invoiceNewStatus = InvoiceStatus.PARTIALLY_PAID;
            } else {
              invoiceNewStatus = invoice.status;
            }

            await manager.update(Invoice, { id: credit.invoiceId }, {
              paidAmount: invoiceNewPaidAmount,
              balanceDue: invoiceNewBalanceDue,
              status: invoiceNewStatus,
            });

            // SINCRONIZACIÓN DE HISTORIAL: Crear registro de pago en factura
            // Solo si este pago NO vino de una sincronización desde facturas (evitar loop)
            const isFromInvoiceSync = dto.reference?.startsWith(SYNC_FROM_INVOICE_PREFIX);

            if (!isFromInvoiceSync) {
              // Generar número de pago único para la factura
              const year = new Date().getFullYear();
              const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
              const paymentNumber = `PAY-${year}-${randomPart}`;

              // Mapear método de pago a enum de factura
              const invoicePaymentMethod = this.mapCreditPaymentMethodToInvoice(dto.paymentMethod);

              const invoicePayment = manager.create(Payment, {
                paymentNumber,
                amount: effectivePaymentAmount,
                paymentMethod: invoicePaymentMethod,
                paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
                reference: `${SYNC_FROM_CREDIT_PREFIX}${savedPayment.id}`,
                notes: dto.notes ? `[Desde Créditos] ${dto.notes}` : '[Pago sincronizado desde módulo de Créditos]',
                invoiceId: credit.invoiceId,
                bankAccountId: dto.bankAccountId || null,
                organizationId: tenantId,
                createdById,
              });

              await manager.save(Payment, invoicePayment);
              console.log(`📝 [Credits→Invoice] Pago registrado en historial de factura ${invoice.number}`);
            }

            console.log(`🔄 [Credits→Invoice] Factura ${invoice.number} sincronizada. Pagado: $${invoiceNewPaidAmount}, Saldo: $${invoiceNewBalanceDue}, Estado: ${invoiceNewStatus}`);
          }
        } catch (error) {
          console.error(`❌ [Credits] Error al sincronizar factura:`, error.message);
          // No lanzar error para no afectar el pago del crédito
        }
      }

      // 7. Si hay sobrepago, crear saldo a favor (el registro ya quedó en la transacción de pago)
      if (overpaymentAmount > 0) {
        try {
          await this.clientBalanceService.depositBalance(
            credit.customerId,
            overpaymentAmount,
            `Sobrepago de crédito #${creditId.substring(0, 8)} - Exceso aplicado como saldo a favor`,
            createdById,
            creditId,
          );
          console.log(`✅ [Credits] Saldo a favor de $${overpaymentAmount} creado (trazabilidad incluida en transacción de pago)`);
        } catch (error) {
          console.error(`❌ [Credits] Error al crear saldo a favor:`, error.message);
        }
      }

      const updatedCredit = await this.findOne(creditId);

      return {
        credit: updatedCredit,
        payment: savedPayment,
      };
    });
  }

  /**
   * Agregar monto a un crédito existente (aumentar deuda)
   */
  async addAmountToCredit(
    creditId: string,
    amount: number,
    description: string,
    createdById: string,
  ): Promise<CustomerCredit> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const credit = await this.findOne(creditId);

    if (credit.status === CreditStatus.PAID) {
      throw new BadRequestException('No se puede agregar monto a un crédito pagado');
    }

    if (credit.status === CreditStatus.CANCELLED) {
      throw new BadRequestException('No se puede agregar monto a un crédito cancelado');
    }

    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    console.log(`📝 [Credits] Agregando $${amount} al crédito ${creditId}`);

    return this.dataSource.transaction(async (manager) => {
      const newTotalAmount = credit.originalAmount + amount;
      const newBalanceDue = credit.balanceDue + amount;

      // 1. Actualizar el crédito
      await manager.update(CustomerCredit, { id: creditId }, {
        originalAmount: newTotalAmount,
        balanceDue: newBalanceDue,
        status: CreditStatus.PENDING, // Volver a pendiente si estaba parcialmente pagado
      });

      // 2. Registrar transacción
      const transaction = manager.create(CreditTransaction, {
        creditId,
        type: CreditTransactionType.DEBT_INCREASE,
        amount: amount,
        description: description,
        balanceAfter: newBalanceDue,
        organizationId: tenantId,
        createdById,
      });
      await manager.save(CreditTransaction, transaction);

      // 3. Actualizar balance del cliente
      await this.customersService.updateBalance(
        credit.customerId,
        amount,
        'add',
      );

      console.log(`✅ [Credits] Monto agregado. Nueva deuda: $${newTotalAmount}`);

      return this.findOne(creditId);
    });
  }

  /**
   * Aplicar saldo a favor manualmente a un crédito existente
   * @param creditId ID del crédito
   * @param createdById ID del usuario
   * @param amountToApply Monto a aplicar (opcional, por defecto aplica todo el saldo disponible)
   */
  async applyClientBalanceManually(
    creditId: string,
    createdById: string,
    amountToApply?: number,
  ): Promise<CustomerCredit> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const credit = await this.findOne(creditId);

    if (credit.status === CreditStatus.PAID) {
      throw new BadRequestException('El crédito ya está pagado');
    }

    if (credit.status === CreditStatus.CANCELLED) {
      throw new BadRequestException('El crédito está cancelado');
    }

    const clientBalance = await this.clientBalanceService.getClientBalance(credit.customerId);

    if (!clientBalance || Number(clientBalance.balance) <= 0) {
      throw new BadRequestException('El cliente no tiene saldo a favor disponible');
    }

    const availableBalance = Number(clientBalance.balance);
    const remainingAmount = Number(credit.balanceDue);

    // Si se especifica un monto, usarlo; de lo contrario, usar el mínimo entre saldo y deuda
    let balanceToUse: number;
    if (amountToApply !== undefined && amountToApply > 0) {
      if (amountToApply > availableBalance) {
        throw new BadRequestException(
          `Monto solicitado ($${amountToApply}) excede el saldo disponible ($${availableBalance})`,
        );
      }
      if (amountToApply > remainingAmount) {
        throw new BadRequestException(
          `Monto solicitado ($${amountToApply}) excede la deuda pendiente ($${remainingAmount})`,
        );
      }
      balanceToUse = amountToApply;
    } else {
      balanceToUse = Math.min(availableBalance, remainingAmount);
    }

    console.log(`🔧 [Credits] Aplicando saldo a favor: $${balanceToUse}`);

    // 1. Usar el saldo a favor
    await this.clientBalanceService.useBalance(
      {
        clientId: credit.customerId,
        amount: balanceToUse,
        description: `Aplicado manualmente al crédito #${creditId.substring(0, 8)}`,
        relatedCreditId: creditId,
      },
      createdById,
    );

    // 2. Crear pago
    const balancePayment = this.paymentRepository.create({
      amount: balanceToUse,
      paymentMethod: 'saldo_favor',
      paymentDate: new Date(),
      notes: 'Abono de saldo a favor (manual)',
      creditId,
      organizationId: tenantId,
      createdById,
    });
    await this.paymentRepository.save(balancePayment);

    // 3. Registrar transacción
    const transaction = this.transactionRepository.create({
      creditId,
      type: CreditTransactionType.BALANCE_USED,
      amount: balanceToUse,
      description: 'Abono de saldo a favor (aplicado manualmente)',
      balanceAfter: remainingAmount - balanceToUse,
      organizationId: tenantId,
      createdById,
    });
    await this.transactionRepository.save(transaction);

    // 4. Actualizar el crédito
    const newPaidAmount = credit.paidAmount + balanceToUse;
    const newBalanceDue = Math.max(0, remainingAmount - balanceToUse);
    const newStatus = newBalanceDue <= 0 ? CreditStatus.PAID : CreditStatus.PARTIALLY_PAID;

    await this.creditRepository.update(
      { id: creditId },
      {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
      },
    );

    // 5. Actualizar balance del cliente
    await this.customersService.updateBalance(
      credit.customerId,
      balanceToUse,
      'subtract',
    );

    // 6. SINCRONIZACIÓN: Actualizar factura asociada si existe
    if (credit.invoiceId) {
      try {
        const invoice = await this.invoiceRepository.findOne({
          where: { id: credit.invoiceId },
        });

        if (invoice) {
          // El saldo de la factura debe ser igual al saldo del crédito
          const invoiceNewBalanceDue = newBalanceDue;
          const invoiceNewPaidAmount = Math.max(0, Number(invoice.total) - invoiceNewBalanceDue);

          let invoiceNewStatus: InvoiceStatus;
          if (invoiceNewBalanceDue <= 0) {
            invoiceNewStatus = InvoiceStatus.PAID;
          } else if (invoiceNewPaidAmount > 0) {
            invoiceNewStatus = InvoiceStatus.PARTIALLY_PAID;
          } else {
            invoiceNewStatus = invoice.status;
          }

          await this.invoiceRepository.update(
            { id: credit.invoiceId },
            {
              paidAmount: invoiceNewPaidAmount,
              balanceDue: invoiceNewBalanceDue,
              status: invoiceNewStatus,
            },
          );

          console.log(`🔄 [Credits→Invoice] Factura ${invoice.number} sincronizada. Pagado: $${invoiceNewPaidAmount}, Saldo: $${invoiceNewBalanceDue}`);
        }
      } catch (error) {
        console.error(`❌ [Credits] Error al sincronizar factura:`, error.message);
      }
    }

    console.log(`✅ [Credits] Saldo a favor aplicado. Nueva deuda: $${newBalanceDue}`);

    return this.findOne(creditId);
  }

  /**
   * Obtener pagos de un crédito
   */
  async getPayments(creditId: string): Promise<CreditPayment[]> {
    await this.findOne(creditId);

    return this.paymentRepository.find({
      where: { creditId },
      relations: ['bankAccount', 'createdBy'],
      order: { paymentDate: 'DESC' },
    });
  }

  /**
   * Obtener transacciones de un crédito
   */
  async getTransactions(creditId: string): Promise<CreditTransaction[]> {
    await this.findOne(creditId);

    return this.transactionRepository.find({
      where: { creditId },
      relations: ['createdBy', 'bankAccount'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cancelar un crédito
   */
  async cancel(id: string): Promise<CustomerCredit> {
    const credit = await this.findOne(id);

    if (credit.status === CreditStatus.PAID) {
      throw new BadRequestException('No se puede cancelar un crédito ya pagado');
    }

    if (credit.status === CreditStatus.CANCELLED) {
      throw new BadRequestException('El crédito ya está cancelado');
    }

    if (credit.balanceDue > 0) {
      await this.customersService.updateBalance(
        credit.customerId,
        credit.balanceDue,
        'subtract',
      );
    }

    await this.creditRepository.update({ id }, {
      status: CreditStatus.CANCELLED,
    });

    console.log(`🚫 [Credits] Crédito cancelado: $${credit.originalAmount}`);

    return this.findOne(id);
  }

  /**
   * Marcar créditos vencidos
   */
  async markOverdueCredits(): Promise<number> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const result = await this.creditRepository.update(
      {
        organizationId: tenantId,
        status: Not(CreditStatus.PAID),
        dueDate: LessThan(new Date()),
        deletedAt: IsNull(),
      },
      {
        status: CreditStatus.OVERDUE,
      },
    );

    if (result.affected && result.affected > 0) {
      console.log(`⚠️ ${result.affected} créditos marcados como vencidos`);
    }

    return result.affected || 0;
  }

  /**
   * Obtener estadísticas de créditos con desglose por tipo (directo vs factura)
   * Usa una sola query SQL aggregada para máximo rendimiento
   */
  async getStats(): Promise<{
    totalPending: number;
    totalOverdue: number;
    countPending: number;
    countOverdue: number;
    totalPaid: number;
    directPending: number;
    invoicePending: number;
    directOverdue: number;
    invoiceOverdue: number;
    directPaid: number;
    invoicePaid: number;
    directCountPending: number;
    invoiceCountPending: number;
    directCountOverdue: number;
    invoiceCountOverdue: number;
  }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const result = await this.creditRepository
      .createQueryBuilder('c')
      .select([
        `COALESCE(SUM(CASE WHEN c.status IN ('pending','partially_paid') THEN c.balance_due ELSE 0 END), 0) AS "totalPending"`,
        `COALESCE(SUM(CASE WHEN c.status = 'overdue' THEN c.balance_due ELSE 0 END), 0) AS "totalOverdue"`,
        `COUNT(CASE WHEN c.status IN ('pending','partially_paid') THEN 1 END) AS "countPending"`,
        `COUNT(CASE WHEN c.status = 'overdue' THEN 1 END) AS "countOverdue"`,
        `COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.original_amount ELSE 0 END), 0) AS "totalPaid"`,
        `COALESCE(SUM(CASE WHEN c.status IN ('pending','partially_paid') AND c.invoice_id IS NULL THEN c.balance_due ELSE 0 END), 0) AS "directPending"`,
        `COALESCE(SUM(CASE WHEN c.status = 'overdue' AND c.invoice_id IS NULL THEN c.balance_due ELSE 0 END), 0) AS "directOverdue"`,
        `COALESCE(SUM(CASE WHEN c.status = 'paid' AND c.invoice_id IS NULL THEN c.original_amount ELSE 0 END), 0) AS "directPaid"`,
        `COUNT(CASE WHEN c.status IN ('pending','partially_paid') AND c.invoice_id IS NULL THEN 1 END) AS "directCountPending"`,
        `COUNT(CASE WHEN c.status = 'overdue' AND c.invoice_id IS NULL THEN 1 END) AS "directCountOverdue"`,
        `COALESCE(SUM(CASE WHEN c.status IN ('pending','partially_paid') AND c.invoice_id IS NOT NULL THEN c.balance_due ELSE 0 END), 0) AS "invoicePending"`,
        `COALESCE(SUM(CASE WHEN c.status = 'overdue' AND c.invoice_id IS NOT NULL THEN c.balance_due ELSE 0 END), 0) AS "invoiceOverdue"`,
        `COALESCE(SUM(CASE WHEN c.status = 'paid' AND c.invoice_id IS NOT NULL THEN c.original_amount ELSE 0 END), 0) AS "invoicePaid"`,
        `COUNT(CASE WHEN c.status IN ('pending','partially_paid') AND c.invoice_id IS NOT NULL THEN 1 END) AS "invoiceCountPending"`,
        `COUNT(CASE WHEN c.status = 'overdue' AND c.invoice_id IS NOT NULL THEN 1 END) AS "invoiceCountOverdue"`,
      ])
      .where('c.organization_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL')
      .getRawOne();

    return {
      totalPending: parseFloat(result.totalPending) || 0,
      totalOverdue: parseFloat(result.totalOverdue) || 0,
      countPending: parseInt(result.countPending) || 0,
      countOverdue: parseInt(result.countOverdue) || 0,
      totalPaid: parseFloat(result.totalPaid) || 0,
      directPending: parseFloat(result.directPending) || 0,
      invoicePending: parseFloat(result.invoicePending) || 0,
      directOverdue: parseFloat(result.directOverdue) || 0,
      invoiceOverdue: parseFloat(result.invoiceOverdue) || 0,
      directPaid: parseFloat(result.directPaid) || 0,
      invoicePaid: parseFloat(result.invoicePaid) || 0,
      directCountPending: parseInt(result.directCountPending) || 0,
      invoiceCountPending: parseInt(result.invoiceCountPending) || 0,
      directCountOverdue: parseInt(result.directCountOverdue) || 0,
      invoiceCountOverdue: parseInt(result.invoiceCountOverdue) || 0,
    };
  }

  /**
   * Soft delete de crédito
   */
  async softDelete(id: string): Promise<void> {
    const credit = await this.findOne(id);

    if (credit.balanceDue > 0 && credit.status !== CreditStatus.CANCELLED) {
      await this.customersService.updateBalance(
        credit.customerId,
        credit.balanceDue,
        'subtract',
      );
    }

    await this.creditRepository.update({ id }, {
      deletedAt: new Date(),
    });
  }

  /**
   * Obtener cuenta corriente consolidada de un cliente
   * Separa deudas de facturas vs créditos directos
   */
  async getCustomerAccount(customerId: string): Promise<{
    customer: {
      id: string;
      name: string;
      currentBalance: number;
    };
    summary: {
      totalDebt: number;
      invoiceDebt: number;
      directCreditDebt: number;
      availableBalance: number;
      netBalance: number;
    };
    invoiceCredits: CustomerCredit[];
    directCredits: CustomerCredit[];
    clientBalance: {
      balance: number;
      lastTransaction?: Date;
    };
  }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Obtener cliente
    const customer = await this.customersService.findOne(customerId);
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Obtener todos los créditos activos del cliente
    const allCredits = await this.creditRepository.find({
      where: {
        customerId,
        organizationId: tenantId,
        deletedAt: IsNull(),
        status: Not(CreditStatus.CANCELLED),
      },
      relations: ['invoice', 'customer'],
      order: { createdAt: 'DESC' },
    });

    // Separar créditos de facturas vs directos
    const invoiceCredits = allCredits.filter(c => c.invoiceId !== null);
    const directCredits = allCredits.filter(c => c.invoiceId === null);

    // Calcular totales
    const invoiceDebt = invoiceCredits
      .filter(c => c.status !== CreditStatus.PAID)
      .reduce((sum, c) => sum + Number(c.balanceDue), 0);

    const directCreditDebt = directCredits
      .filter(c => c.status !== CreditStatus.PAID)
      .reduce((sum, c) => sum + Number(c.balanceDue), 0);

    const totalDebt = invoiceDebt + directCreditDebt;

    // Obtener saldo a favor
    let availableBalance = 0;
    let lastBalanceTransaction: Date | undefined;
    try {
      const balance = await this.clientBalanceService.getClientBalance(customerId);
      availableBalance = balance?.balance || 0;
      // Obtener última transacción si existe
      if (balance) {
        const transactions = await this.clientBalanceService.getClientTransactions(customerId);
        if (transactions.length > 0) {
          lastBalanceTransaction = transactions[0].createdAt;
        }
      }
    } catch (error) {
      // Si no tiene saldo, continuar con 0
    }

    return {
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName || ''}`.trim(),
        currentBalance: Number(customer.currentBalance) || 0,
      },
      summary: {
        totalDebt,
        invoiceDebt,
        directCreditDebt,
        availableBalance,
        netBalance: totalDebt - availableBalance,
      },
      invoiceCredits: invoiceCredits.filter(c => c.status !== CreditStatus.PAID),
      directCredits: directCredits.filter(c => c.status !== CreditStatus.PAID),
      clientBalance: {
        balance: availableBalance,
        lastTransaction: lastBalanceTransaction,
      },
    };
  }

  /**
   * Mapea el método de pago de créditos (string) al enum de facturas
   */
  private mapCreditPaymentMethodToInvoice(creditMethod: string): PaymentMethod {
    const methodMap: Record<string, PaymentMethod> = {
      'cash': PaymentMethod.CASH,
      'efectivo': PaymentMethod.CASH,
      'bank_transfer': PaymentMethod.BANK_TRANSFER,
      'transferencia': PaymentMethod.BANK_TRANSFER,
      'transferencia_bancaria': PaymentMethod.BANK_TRANSFER,
      'credit_card': PaymentMethod.CREDIT_CARD,
      'tarjeta_credito': PaymentMethod.CREDIT_CARD,
      'debit_card': PaymentMethod.DEBIT_CARD,
      'tarjeta_debito': PaymentMethod.DEBIT_CARD,
      'nequi': PaymentMethod.BANK_TRANSFER, // Nequi se mapea a transferencia
      'daviplata': PaymentMethod.BANK_TRANSFER, // Daviplata se mapea a transferencia
      'check': PaymentMethod.CHECK,
      'cheque': PaymentMethod.CHECK,
      'saldo_favor': PaymentMethod.CASH, // Saldo a favor se registra como efectivo
      'credit': PaymentMethod.CREDIT,
      'credito': PaymentMethod.CREDIT,
      'other': PaymentMethod.OTHER,
      'otro': PaymentMethod.OTHER,
      'multiple': PaymentMethod.OTHER, // Pagos múltiples
    };

    return methodMap[creditMethod.toLowerCase()] || PaymentMethod.OTHER;
  }

  /**
   * Mapea el método de pago de facturas (enum) al string de créditos
   */
  private mapInvoicePaymentMethodToCredit(invoiceMethod: PaymentMethod): string {
    const methodMap: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'cash',
      [PaymentMethod.BANK_TRANSFER]: 'bank_transfer',
      [PaymentMethod.CREDIT_CARD]: 'credit_card',
      [PaymentMethod.DEBIT_CARD]: 'debit_card',
      [PaymentMethod.CHECK]: 'check',
      [PaymentMethod.CREDIT]: 'credit',
      [PaymentMethod.CLIENT_BALANCE]: 'saldo_favor',
      [PaymentMethod.OTHER]: 'other',
    };

    return methodMap[invoiceMethod] || 'other';
  }
}
