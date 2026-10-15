// src/customer-credits/customer-credits.service.ts
import { tenantCalendarDateOf, tenantRangeEndOf, tenantRangeStartOf, tenantWallClockNow } from '../common/utils/tenant-clock';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, LessThan, IsNull, Not } from 'typeorm';
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
import { ClientBalance } from './entities/client-balance.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CashRegisterService } from '../cash-register/cash-register.service';
import {
  parseClientDateTime,
  parseClientDateTimeLegacy,
} from '../common/utils/timezone-range.util';
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
    occurredAt?: Date | null,
  ): Promise<void> {
    if (paymentMethod !== PaymentMethod.CASH) return;
    // Abono hecho sin conexión que sube ahora: ya ocurrió, no se rechaza.
    if (CashRegisterService.isQueuedEvent(occurredAt)) return;

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

    // UN SOLO CRÉDITO POR FACTURA: el crédito de una venta fiada nace junto
    // con la factura (misma transacción). Si la app pide crearlo otra vez
    // (versiones anteriores lo hacían en una segunda petición, o es un
    // reenvío), se devuelve el que ya existe en vez de duplicar la deuda.
    if (dto.invoiceId) {
      const existingForInvoice = await this.creditRepository.findOne({
        where: {
          invoiceId: dto.invoiceId,
          organizationId: tenantId,
          deletedAt: IsNull(),
        },
      });
      if (existingForInvoice) {
        return this.findOne(existingForInvoice.id);
      }
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

    // LÍMITE DE CRÉDITO: una deuda directa (sin factura) no puede llevar al
    // cliente por encima de su cupo. Los créditos que nacen de una factura ya
    // fueron validados al crear la factura; validarlos otra vez aquí dejaría
    // la factura guardada sin su crédito.
    if (!dto.invoiceId) {
      await this.customersService.assertWithinCreditLimit(
        customer,
        Number(dto.originalAmount),
      );
    }

    console.log(`📝 [Credits] Creando crédito de $${dto.originalAmount} para cliente ${customer.firstName}`);

    return this.dataSource.transaction(async (manager) => {
      // 1. Crear el crédito
      const credit = manager.create(CustomerCredit, {
        originalAmount: dto.originalAmount,
        paidAmount: 0,
        balanceDue: dto.originalAmount,
        status: CreditStatus.PENDING,
        dueDate: tenantCalendarDateOf(dto.dueDate),
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
        startDate: tenantRangeStartOf(query.startDate),
      });
    }
    if (query.endDate) {
      qb.andWhere('credit.createdAt <= :endDate', {
        endDate: tenantRangeEndOf(query.endDate),
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
   * Redondear a 2 decimales (centavos). Evita residuos de punto flotante
   * como 0.01999999998 en saldos y sobrepagos.
   */
  private roundMoney(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  /**
   * Normalizar la clave de idempotencia recibida (body o header).
   */
  private normalizeIdempotencyKey(...candidates: (string | undefined | null)[]): string | null {
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const key = candidate.trim();
      if (key.length > 0 && key.length <= 64) return key;
    }
    return null;
  }

  /**
   * Ejecutar una operación de crédito dentro de una transacción con bloqueo
   * por cliente y por crédito.
   *
   * Orden de bloqueo SIEMPRE igual (cliente → crédito) para que dos
   * operaciones del mismo cliente se ejecuten una detrás de otra y nunca
   * lean un saldo viejo. `FOR NO KEY UPDATE` bloquea a otros escritores sin
   * chocar con las llaves foráneas que apuntan a estas filas.
   *
   * Si la base aborta por deadlock, serialización o espera de bloqueo, se
   * reintenta; si aun así no se logra, se responde 503 (reintentable) y NO
   * se guarda nada a medias.
   */
  private async runLockedCreditOperation<T>(
    creditId: string,
    tenantId: string,
    work: (manager: EntityManager, credit: CustomerCredit) => Promise<T>,
  ): Promise<T> {
    const creditRef = await this.creditRepository.findOne({
      where: { id: creditId, organizationId: tenantId, deletedAt: IsNull() },
      select: ['id', 'customerId'],
    });
    if (!creditRef) {
      throw new NotFoundException('Crédito no encontrado');
    }

    const retryableCodes = ['40P01', '40001', '55P03'];
    const maxAttempts = 3;

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          // Nunca esperar un bloqueo indefinidamente.
          await manager.query(`SET LOCAL lock_timeout = '15s'`);

          // 1. Bloquear al cliente: serializa todas sus operaciones de crédito.
          await manager.query(
            `SELECT id FROM customers WHERE id = $1 AND organization_id = $2 FOR NO KEY UPDATE`,
            [creditRef.customerId, tenantId],
          );

          // 2. Bloquear el crédito y leer su estado REAL dentro de la transacción.
          const credit = await manager
            .createQueryBuilder(CustomerCredit, 'credit')
            .setLock('for_no_key_update')
            .where('credit.id = :creditId', { creditId })
            .andWhere('credit.organizationId = :tenantId', { tenantId })
            .andWhere('credit.deletedAt IS NULL')
            .getOne();

          if (!credit) {
            throw new NotFoundException('Crédito no encontrado');
          }

          return work(manager, credit);
        });
      } catch (error) {
        const code = error?.code ?? error?.driverError?.code;
        if (retryableCodes.includes(code)) {
          if (attempt < maxAttempts) {
            console.warn(
              `⏳ [Credits] Bloqueo/deadlock (${code}) en crédito ${creditId}, reintento ${attempt}/${maxAttempts - 1}`,
            );
            await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
            continue;
          }
          throw new ServiceUnavailableException(
            'El crédito está siendo actualizado por otra operación. Intenta de nuevo en unos segundos.',
          );
        }
        throw error;
      }
    }
  }

  /**
   * Respuesta para un abono que ya estaba registrado (reintento del cliente).
   * Devuelve el estado actual del crédito sin volver a aplicar nada.
   */
  private async buildIdempotentPaymentResponse(
    existingPayment: CreditPayment,
    creditId: string,
  ): Promise<{ credit: CustomerCredit; payment: CreditPayment; idempotent: boolean }> {
    if (existingPayment.creditId !== creditId) {
      throw new BadRequestException(
        'La clave de idempotencia ya fue usada en un abono de otro crédito',
      );
    }
    console.log(
      `♻️ [Credits] Abono repetido detectado (pago ${existingPayment.id}) — se devuelve el ya registrado, sin duplicar`,
    );
    return {
      credit: await this.findOne(creditId),
      payment: existingPayment,
      idempotent: true,
    };
  }

  /**
   * Agregar un abono al crédito.
   *
   * Garantías:
   * - Todo o nada: abono, saldo del crédito, movimiento, factura, saldo a
   *   favor y acumulados del cliente se guardan en UNA transacción.
   * - Sin carreras: el estado del crédito se lee con bloqueo dentro de la
   *   transacción, así dos abonos simultáneos se aplican uno tras otro.
   * - Sin duplicados: un abono reenviado (misma clave de idempotencia, o el
   *   mismo abono exacto reenviado por una versión vieja de la app) devuelve
   *   el abono ya registrado en vez de crear otro.
   */
  async addPayment(
    creditId: string,
    dto: AddCreditPaymentDto,
    createdById: string,
    headerIdempotencyKey?: string,
  ): Promise<{ credit: CustomerCredit; payment: CreditPayment; idempotent?: boolean }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const paymentAmount = this.roundMoney(dto.amount);
    if (paymentAmount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero');
    }

    const idempotencyKey = this.normalizeIdempotencyKey(
      dto.idempotencyKey,
      headerIdempotencyKey,
    );
    // Las versiones anteriores de la app mandan una clave automática
    // (`idem_...`) calculada por request, que cambia entre reintentos. Solo
    // las claves explícitas identifican al abono de forma estable.
    const hasStableKey = !!idempotencyKey && !idempotencyKey.startsWith('idem_');

    // La hora del abono llega del dispositivo. Si viene sin zona horaria es
    // la hora del reloj del negocio: se interpreta en la zona del tenant (no
    // como UTC), para que el abono quede en la hora real y entre en el turno
    // de caja correcto.
    const organizationForTz = await this.organizationRepository.findOne({
      where: { id: tenantId },
      select: ['id', 'timezone'],
    });
    const tenantTimezone = organizationForTz?.timezone || 'America/Bogota';
    const paymentDate = parseClientDateTime(dto.paymentDate, tenantTimezone);
    if (dto.paymentDate && !paymentDate) {
      throw new BadRequestException('La fecha debe ser válida');
    }
    // Misma fecha leída como antes de la corrección (sin zona = UTC): solo
    // para reconocer el reenvío de un abono guardado con la hora antigua.
    const legacyPaymentDate = parseClientDateTimeLegacy(dto.paymentDate);

    // Reintento de un abono ya confirmado: responder de inmediato, ANTES de
    // validar caja (la caja pudo cerrarse después y el abono ya existe).
    if (idempotencyKey) {
      const alreadySaved = await this.paymentRepository.findOne({
        where: { organizationId: tenantId, idempotencyKey },
        withDeleted: true,
      });
      if (alreadySaved) {
        return this.buildIdempotentPaymentResponse(alreadySaved, creditId);
      }
    }

    // 🔒 PHASE 2: caja abierta requerida si el pago es en efectivo y el
    // tenant tiene el módulo activo. Bloqueo temprano para no encolar la
    // transacción y revertir después.
    await this.validateCashRegisterIfNeeded(
      dto.paymentMethod,
      tenantId,
      paymentDate,
    );

    let outcome: { payment: CreditPayment; duplicate: boolean };
    try {
      outcome = await this.runLockedCreditOperation(
        creditId,
        tenantId,
        async (manager, credit) => {
          // A. Idempotencia bajo bloqueo: si otro request con la misma clave
          //    acaba de confirmar, aquí ya se ve.
          if (idempotencyKey) {
            const existing = await manager.findOne(CreditPayment, {
              where: { organizationId: tenantId, idempotencyKey },
        withDeleted: true,
            });
            if (existing) {
              return { payment: existing, duplicate: true };
            }
          }

          // B. Protección para versiones anteriores de la app (sin clave
          //    estable): el mismo abono exacto —mismo crédito, monto, método
          //    y la misma marca de tiempo del dispositivo— es un reenvío.
          //    Solo aplica a marcas de tiempo precisas; una fecha elegida en
          //    el calendario (medianoche) no identifica a un abono.
          if (!hasStableKey && paymentDate) {
            const isPreciseTimestamp =
              paymentDate.getUTCSeconds() !== 0 ||
              paymentDate.getUTCMilliseconds() !== 0;
            if (isPreciseTimestamp) {
              const sameSubmission = await manager
                .createQueryBuilder(CreditPayment, 'payment')
                .where('payment.creditId = :creditId', { creditId })
                .andWhere('payment.organizationId = :tenantId', { tenantId })
                .andWhere('payment.amount = :amount', { amount: paymentAmount })
                .andWhere('payment.paymentMethod = :paymentMethod', {
                  paymentMethod: dto.paymentMethod,
                })
                .andWhere('payment.paymentDate IN (:...paymentDates)', {
                  paymentDates: [paymentDate, legacyPaymentDate ?? paymentDate],
                })
                .andWhere('payment.deletedAt IS NULL')
                .getOne();
              if (sameSubmission) {
                return { payment: sameSubmission, duplicate: true };
              }
            }
          }

          if (credit.status === CreditStatus.PAID) {
            throw new BadRequestException('El crédito ya está pagado completamente');
          }

          if (credit.status === CreditStatus.CANCELLED) {
            throw new BadRequestException('No se puede abonar a un crédito cancelado');
          }

          // Calcular con el saldo REAL (leído con bloqueo)
          const remainingAmount = this.roundMoney(credit.balanceDue);
          const overpaymentAmount = this.roundMoney(
            Math.max(0, paymentAmount - remainingAmount),
          );
          const effectivePaymentAmount = this.roundMoney(
            Math.min(paymentAmount, remainingAmount),
          );
          if (overpaymentAmount > 0) {
            console.log(`💰 [Credits] Sobrepago detectado: $${overpaymentAmount}`);
          }

          // 1. Crear el pago
          const payment = manager.create(CreditPayment, {
            amount: paymentAmount,
            paymentMethod: dto.paymentMethod,
            paymentDate: paymentDate ?? new Date(),
            reference: dto.reference,
            notes: dto.notes,
            creditId,
            bankAccountId: dto.bankAccountId || null,
            organizationId: tenantId,
            createdById,
            idempotencyKey: idempotencyKey || null,
          });

          const savedPayment = await manager.save(CreditPayment, payment);

          // 2. Calcular nuevo estado
          const newPaidAmount = this.roundMoney(
            Number(credit.paidAmount) + effectivePaymentAmount,
          );
          const newBalanceDue = this.roundMoney(
            Math.max(0, Number(credit.originalAmount) - newPaidAmount),
          );
          const newStatus =
            newBalanceDue <= 0 ? CreditStatus.PAID : CreditStatus.PARTIALLY_PAID;

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

          console.log(`💰 [Credits] Abono de $${paymentAmount}. Saldo: $${newBalanceDue}`);

          // 5. SINCRONIZACIÓN: Actualizar factura asociada si existe
          // IMPORTANTE: El crédito representa el saldo pendiente de la factura.
          // Por lo tanto, el balanceDue de la factura debe ser IGUAL al balanceDue del crédito.
          // NO debemos sumar el pago, sino sincronizar directamente el saldo.
          // Va dentro de la misma transacción: si falla, no se guarda el abono.
          if (credit.invoiceId) {
            const invoice = await manager.findOne(Invoice, {
              where: { id: credit.invoiceId },
            });

            if (invoice) {
              // El saldo de la factura debe ser exactamente igual al saldo del crédito
              // porque el crédito representa la deuda pendiente de esa factura
              const invoiceNewBalanceDue = newBalanceDue; // Usar el nuevo saldo del crédito directamente
              const invoiceNewPaidAmount = this.roundMoney(
                Math.max(0, Number(invoice.total) - invoiceNewBalanceDue),
              );

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

              if (!isFromInvoiceSync && effectivePaymentAmount > 0) {
                // Generar número de pago único para la factura
                const year = tenantWallClockNow().getFullYear();
                const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
                const paymentNumber = `PAY-${year}-${randomPart}`;

                // Mapear método de pago a enum de factura
                const invoicePaymentMethod = this.mapCreditPaymentMethodToInvoice(dto.paymentMethod);

                const invoicePayment = manager.create(Payment, {
                  paymentNumber,
                  amount: effectivePaymentAmount,
                  paymentMethod: invoicePaymentMethod,
                  paymentDate: paymentDate ?? new Date(),
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
          }

          // 6. Si hay sobrepago, crear saldo a favor EN LA MISMA transacción:
          //    el excedente nunca se pierde ni queda a medias.
          if (overpaymentAmount > 0) {
            await this.clientBalanceService.depositBalance(
              credit.customerId,
              overpaymentAmount,
              `Sobrepago de crédito #${creditId.substring(0, 8)} - Exceso aplicado como saldo a favor`,
              createdById,
              creditId,
              manager,
            );
            console.log(`✅ [Credits] Saldo a favor de $${overpaymentAmount} creado (trazabilidad incluida en transacción de pago)`);
          }

          // 7. Acumulados del cliente recalculados desde los créditos reales
          await this.customersService.recalculateCreditBalances(
            credit.customerId,
            tenantId,
            manager,
          );

          return { payment: savedPayment, duplicate: false };
        },
      );
    } catch (error) {
      // Carrera entre dos requests con la misma clave sobre créditos de
      // clientes distintos: el índice único rechaza al segundo.
      const code = error?.code ?? error?.driverError?.code;
      if (code === '23505' && idempotencyKey) {
        const existing = await this.paymentRepository.findOne({
          where: { organizationId: tenantId, idempotencyKey },
        withDeleted: true,
        });
        if (existing) {
          return this.buildIdempotentPaymentResponse(existing, creditId);
        }
      }
      throw error;
    }

    if (outcome.duplicate) {
      return this.buildIdempotentPaymentResponse(outcome.payment, creditId);
    }

    // Leer DESPUÉS de confirmar la transacción: el crédito devuelto a la app
    // refleja el saldo ya actualizado.
    return {
      credit: await this.findOne(creditId),
      payment: outcome.payment,
    };
  }

  /**
   * Agregar monto a un crédito existente (aumentar deuda)
   */
  async addAmountToCredit(
    creditId: string,
    amount: number,
    description: string,
    createdById: string,
    idempotencyKey?: string,
  ): Promise<CustomerCredit> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    if (!(Number(amount) > 0)) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    const amountToAdd = this.roundMoney(amount);

    console.log(`📝 [Credits] Agregando $${amountToAdd} al crédito ${creditId}`);

    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);

    await this.runLockedCreditOperation(creditId, tenantId, async (manager, credit) => {
      // Reenvío del mismo aumento (reintento / cola offline): ya se aplicó.
      if (operationKey) {
        const alreadyApplied = await manager.findOne(CreditTransaction, {
          where: { organizationId: tenantId, idempotencyKey: operationKey },
        });
        if (alreadyApplied) {
          console.log(`♻️ [Credits] Aumento de deuda repetido (${operationKey}) — no se aplica dos veces`);
          return;
        }
      }

      if (credit.status === CreditStatus.PAID) {
        throw new BadRequestException('No se puede agregar monto a un crédito pagado');
      }

      if (credit.status === CreditStatus.CANCELLED) {
        throw new BadRequestException('No se puede agregar monto a un crédito cancelado');
      }

      // LÍMITE DE CRÉDITO: se valida con el cliente bloqueado, así dos
      // aumentos simultáneos no pueden pasar el cupo entre los dos.
      const customer = await manager.findOne(Customer, {
        where: { id: credit.customerId, organizationId: tenantId },
      });
      if (!customer) {
        throw new NotFoundException('Cliente no encontrado');
      }
      await this.customersService.assertWithinCreditLimit(
        customer,
        amountToAdd,
        manager,
      );

      // Calcular con el saldo REAL (leído con bloqueo)
      const newTotalAmount = this.roundMoney(Number(credit.originalAmount) + amountToAdd);
      const newBalanceDue = this.roundMoney(Number(credit.balanceDue) + amountToAdd);

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
        amount: amountToAdd,
        description: description,
        balanceAfter: newBalanceDue,
        organizationId: tenantId,
        createdById,
        idempotencyKey: operationKey || null,
      });
      await manager.save(CreditTransaction, transaction);

      // 3. Acumulados del cliente recalculados desde los créditos reales
      await this.customersService.recalculateCreditBalances(
        credit.customerId,
        tenantId,
        manager,
      );

      console.log(`✅ [Credits] Monto agregado. Nueva deuda: $${newTotalAmount}`);
    });

    // Leer después de confirmar la transacción
    return this.findOne(creditId);
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
    idempotencyKey?: string,
  ): Promise<CustomerCredit> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const operationKey = this.normalizeIdempotencyKey(idempotencyKey);

    await this.runLockedCreditOperation(creditId, tenantId, async (manager, credit) => {
      // Reenvío de la misma aplicación de saldo (reintento / cola offline).
      if (operationKey) {
        const alreadyApplied = await manager.findOne(CreditPayment, {
          where: { organizationId: tenantId, idempotencyKey: operationKey },
          withDeleted: true,
        });
        if (alreadyApplied) {
          console.log(`♻️ [Credits] Aplicación de saldo repetida (${operationKey}) — no se aplica dos veces`);
          return;
        }
      }

      if (credit.status === CreditStatus.PAID) {
        throw new BadRequestException('El crédito ya está pagado');
      }

      if (credit.status === CreditStatus.CANCELLED) {
        throw new BadRequestException('El crédito está cancelado');
      }

      const clientBalance = await manager.findOne(ClientBalance, {
        where: { customerId: credit.customerId, organizationId: tenantId },
      });

      if (!clientBalance || Number(clientBalance.balance) <= 0) {
        throw new BadRequestException('El cliente no tiene saldo a favor disponible');
      }

      const availableBalance = this.roundMoney(clientBalance.balance);
      const remainingAmount = this.roundMoney(credit.balanceDue);

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
        balanceToUse = this.roundMoney(amountToApply);
      } else {
        balanceToUse = this.roundMoney(Math.min(availableBalance, remainingAmount));
      }

      if (balanceToUse <= 0) {
        throw new BadRequestException('No hay saldo pendiente al cual aplicar el saldo a favor');
      }

      console.log(`🔧 [Credits] Aplicando saldo a favor: $${balanceToUse}`);

      // 1. Usar el saldo a favor (misma transacción)
      await this.clientBalanceService.useBalance(
        {
          clientId: credit.customerId,
          amount: balanceToUse,
          description: `Aplicado manualmente al crédito #${creditId.substring(0, 8)}`,
          relatedCreditId: creditId,
        },
        createdById,
        manager,
      );

      // 2. Crear pago
      const balancePayment = manager.create(CreditPayment, {
        amount: balanceToUse,
        paymentMethod: 'saldo_favor',
        paymentDate: new Date(),
        notes: 'Abono de saldo a favor (manual)',
        creditId,
        organizationId: tenantId,
        createdById,
        idempotencyKey: operationKey || null,
      });
      await manager.save(CreditPayment, balancePayment);

      // 3. Calcular nuevo estado con el saldo REAL (leído con bloqueo)
      const newPaidAmount = this.roundMoney(Number(credit.paidAmount) + balanceToUse);
      const newBalanceDue = this.roundMoney(Math.max(0, remainingAmount - balanceToUse));
      const newStatus = newBalanceDue <= 0 ? CreditStatus.PAID : CreditStatus.PARTIALLY_PAID;

      // 4. Registrar transacción
      const transaction = manager.create(CreditTransaction, {
        creditId,
        type: CreditTransactionType.BALANCE_USED,
        amount: balanceToUse,
        description: 'Abono de saldo a favor (aplicado manualmente)',
        balanceAfter: newBalanceDue,
        organizationId: tenantId,
        createdById,
      });
      await manager.save(CreditTransaction, transaction);

      // 5. Actualizar el crédito
      await manager.update(
        CustomerCredit,
        { id: creditId },
        {
          paidAmount: newPaidAmount,
          balanceDue: newBalanceDue,
          status: newStatus,
        },
      );

      // 6. SINCRONIZACIÓN: Actualizar factura asociada si existe
      if (credit.invoiceId) {
        const invoice = await manager.findOne(Invoice, {
          where: { id: credit.invoiceId },
        });

        if (invoice) {
          // El saldo de la factura debe ser igual al saldo del crédito
          const invoiceNewBalanceDue = newBalanceDue;
          const invoiceNewPaidAmount = this.roundMoney(
            Math.max(0, Number(invoice.total) - invoiceNewBalanceDue),
          );

          let invoiceNewStatus: InvoiceStatus;
          if (invoiceNewBalanceDue <= 0) {
            invoiceNewStatus = InvoiceStatus.PAID;
          } else if (invoiceNewPaidAmount > 0) {
            invoiceNewStatus = InvoiceStatus.PARTIALLY_PAID;
          } else {
            invoiceNewStatus = invoice.status;
          }

          await manager.update(
            Invoice,
            { id: credit.invoiceId },
            {
              paidAmount: invoiceNewPaidAmount,
              balanceDue: invoiceNewBalanceDue,
              status: invoiceNewStatus,
            },
          );

          console.log(`🔄 [Credits→Invoice] Factura ${invoice.number} sincronizada. Pagado: $${invoiceNewPaidAmount}, Saldo: $${invoiceNewBalanceDue}`);
        }
      }

      // 7. Acumulados del cliente recalculados desde los créditos reales
      await this.customersService.recalculateCreditBalances(
        credit.customerId,
        tenantId,
        manager,
      );

      console.log(`✅ [Credits] Saldo a favor aplicado. Nueva deuda: $${newBalanceDue}`);
    });

    // Leer después de confirmar la transacción
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
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    await this.runLockedCreditOperation(id, tenantId, async (manager, credit) => {
      if (credit.status === CreditStatus.PAID) {
        throw new BadRequestException('No se puede cancelar un crédito ya pagado');
      }

      // Cancelar un crédito ya cancelado no es un error: es el reenvío de
      // una cancelación que ya llegó. Se responde OK sin cambiar nada.
      if (credit.status === CreditStatus.CANCELLED) {
        return;
      }

      await manager.update(CustomerCredit, { id }, {
        status: CreditStatus.CANCELLED,
      });

      await this.customersService.recalculateCreditBalances(
        credit.customerId,
        tenantId,
        manager,
      );

      console.log(`🚫 [Credits] Crédito cancelado: $${credit.originalAmount}`);
    });

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
        // Vencido = su fecha es ANTERIOR al día de hoy en el negocio
        dueDate: LessThan(tenantCalendarDateOf(new Date())),
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
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    await this.runLockedCreditOperation(id, tenantId, async (manager, credit) => {
      await manager.update(CustomerCredit, { id }, {
        deletedAt: new Date(),
      });

      await this.customersService.recalculateCreditBalances(
        credit.customerId,
        tenantId,
        manager,
      );
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
