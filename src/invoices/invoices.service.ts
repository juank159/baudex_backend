import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { AddPaymentDto, AddMultiplePaymentsDto } from './dto/payment.dto';
import {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
} from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../common/dto/pagination-response.dto';
import { CustomersService } from '../customers/customers.service';
import { ProductService } from '../products/products.service';
import { TemporaryProductService } from '../products/temporary-product.service';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { UserPreferencesService } from '../users/user-preferences.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationType,
  NotificationSeverity,
} from '../notifications/entities/notification.entity';
import { CustomerCreditsService } from '../customer-credits/customer-credits.service';
import { CustomerCredit, CreditStatus } from '../customer-credits/entities/customer-credit.entity';
import { CreditPayment } from '../customer-credits/entities/credit-payment.entity';
import { CreditTransaction, CreditTransactionType } from '../customer-credits/entities/credit-transaction.entity';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { ClientBalanceService } from '../customer-credits/client-balance.service';
import { SubscriptionService } from '../subscriptions/services/subscription.service';

// Prefijos para identificar pagos sincronizados y evitar loops
const SYNC_FROM_CREDIT_PREFIX = 'SYNC-CRD-';
const SYNC_FROM_INVOICE_PREFIX = 'SYNC-INV-';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly customersService: CustomersService,
    private readonly productsService: ProductService,
    private readonly temporaryProductService: TemporaryProductService,
    private readonly dataSource: DataSource,
    private readonly tenantAwareService: TenantAwareService,
    private readonly userPreferencesService: UserPreferencesService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => CustomerCreditsService))
    private readonly customerCreditsService: CustomerCreditsService,
    private readonly bankAccountsService: BankAccountsService, // 🏦 Servicio de cuentas bancarias
    @Inject(forwardRef(() => ClientBalanceService))
    private readonly clientBalanceService: ClientBalanceService, // 💰 Servicio de saldo a favor
    private readonly subscriptionService: SubscriptionService, // 📋 Servicio de suscripciones
  ) {}

  async create(
    createInvoiceDto: CreateInvoiceDto,
    createdById: string,
  ): Promise<Invoice> {

    // Obtener tenant ID
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // 🔒 VALIDACIÓN DE SUSCRIPCIÓN ACTIVA
    // No permitir crear facturas si la suscripción está vencida
    await this.validateActiveSubscription(tenantId);

    // Verificar que el cliente existe
    const customer = await this.customersService.findOne(
      createInvoiceDto.customerId,
    );

    // 🔴 NUEVA VALIDACIÓN PROFESIONAL: Límite de crédito
    if (createInvoiceDto.paymentMethod === PaymentMethod.CREDIT) {
      await this.validateCreditAvailability(customer, createInvoiceDto);
    }

    // ✅ VERIFICAR PRODUCTOS REGISTRADOS Y CREAR TEMPORALES
    const processedItems = [];

    for (const itemDto of createInvoiceDto.items) {
      if (itemDto.isTemporary) {
        // ✅ CREAR PRODUCTO TEMPORAL

        const temporaryProduct = await this.temporaryProductService.create({
          name: itemDto.description,
          description: `Producto temporal creado en factura`,
          unitPrice: itemDto.unitPrice,
          unit: itemDto.unit || 'pcs',
          category: itemDto.category || 'Sin categoría',
          metadata: {
            ...itemDto.metadata,
            createdInInvoice: true,
            originalPrice: itemDto.unitPrice,
          },
        });

        processedItems.push({
          ...itemDto,
          temporaryProductId: temporaryProduct.id,
          productId: null,
        });
      } else if (itemDto.productId) {
        // ✅ VALIDAR PRODUCTO REGISTRADO
        const product = await this.productsService.findOne(itemDto.productId);

        // 📦 Solo validar stock si skipStockValidation no está activo
        if (!createInvoiceDto.skipStockValidation) {
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

        processedItems.push({
          ...itemDto,
          temporaryProductId: null,
        });
      } else {
        throw new BadRequestException(
          `Item inválido: debe tener productId o ser marcado como temporal`,
        );
      }
    }

    // 🌐 OBTENER TIMEZONE DE LA ORGANIZACIÓN para fechas correctas
    const organization = await this.organizationRepository.findOne({
      where: { id: tenantId },
      select: ['id', 'timezone'],
    });
    const orgTimezone = organization?.timezone || 'America/New_York';

    return this.dataSource.transaction(async (manager) => {
      // Calcular status
      const finalStatus =
        createInvoiceDto.status ||
        this.calculateInitialStatus(createInvoiceDto.paymentMethod);

      // 📅 CALCULAR FECHA DE VENCIMIENTO INTELIGENTEMENTE
      // El backend es el dueño de esta lógica, NO el frontend
      const calculatedDueDate = this.calculateSmartDueDate(
        createInvoiceDto.paymentMethod,
        customer,
        createInvoiceDto.metadata,
        orgTimezone,
      );

      // 📅 CALCULAR FECHA EN TIMEZONE DE LA ORGANIZACIÓN (no UTC)
      // Si el frontend envía "2026-03-13T01:00:00Z" pero el tenant está en UTC-5,
      // la fecha real del negocio es 2026-03-12, no 2026-03-13
      const invoiceDateUtc = createInvoiceDto.date
        ? new Date(createInvoiceDto.date)
        : new Date();
      const invoiceDateStr = invoiceDateUtc.toLocaleDateString('en-CA', {
        timeZone: orgTimezone,
      }); // "YYYY-MM-DD" en timezone del tenant

      // Crear factura
      const invoice = manager.create(Invoice, {
        number: createInvoiceDto.number,
        date: new Date(invoiceDateStr + 'T12:00:00'), // Mediodía para evitar edge cases de timezone
        dueDate: calculatedDueDate, // 📅 SIEMPRE usar la fecha calculada por el backend
        paymentMethod: createInvoiceDto.paymentMethod || PaymentMethod.CASH,
        taxPercentage: createInvoiceDto.taxPercentage || 19,
        discountPercentage: createInvoiceDto.discountPercentage || 0,
        discountAmount: createInvoiceDto.discountAmount || 0,
        notes: createInvoiceDto.notes,
        terms: createInvoiceDto.terms,
        metadata: createInvoiceDto.metadata,
        customerId: createInvoiceDto.customerId,
        createdById,
        status: finalStatus,
        organizationId: tenantId, // ✅ AGREGADO: organization_id del tenant

        // ✅ CREAR ITEMS CON PRODUCTOS TEMPORALES Y CÁLCULO FIFO
        items: await Promise.all(
          processedItems.map(async (itemDto) => {
            let unitCost = 0;
            let totalCost = 0;
            let itemTaxPercentage = 0; // ✅ IVA del item basado en el producto

            // ✅ CALCULAR COSTO FIFO PARA PRODUCTOS REGISTRADOS
            if (itemDto.productId) {
              try {
                // ✅ OBTENER EL PRODUCTO PARA SABER SU IVA
                const product = await this.productsService.findOne(itemDto.productId);

                // ✅ DETERMINAR SI EL PRODUCTO TIENE IVA BASÁNDOSE EN:
                // 1. isTaxable debe ser true
                // 2. taxCategory NO puede ser NO_GRAVADO ni EXENTO
                // 3. taxRate debe ser mayor a 0
                const isNoGravado = product?.taxCategory === 'NO_GRAVADO';
                const isExento = product?.taxCategory === 'EXENTO';
                const hasTax = product?.isTaxable && !isNoGravado && !isExento && Number(product?.taxRate) > 0;

                if (hasTax) {
                  itemTaxPercentage = Number(product.taxRate) || 0;
                } else {
                  itemTaxPercentage = 0;
                }

                const fifoCost = await this.inventoryService.calculateFifoCost(
                  itemDto.productId,
                  itemDto.quantity,
                  tenantId,
                );
                unitCost = fifoCost.unitCost;
                totalCost = fifoCost.totalCost;
              } catch (error) {
                console.warn(
                  `⚠️ No se pudo calcular FIFO para producto ${itemDto.productId}: ${error.message}`,
                );
                // Continuar sin FIFO cost (quedará en 0)
              }
            } else if (itemDto.temporaryProductId) {
              // ✅ CALCULAR COSTO ESTIMADO PARA PRODUCTOS TEMPORALES
              // Productos temporales no tienen IVA configurado, usar valor por defecto
              itemTaxPercentage = createInvoiceDto.taxPercentage || 19;

              try {
                const organization = await this.organizationRepository.findOne({
                  where: { id: tenantId },
                });

                // Obtener margen de ganancia configurado (por defecto 20%)
                const defaultMarginPercent = 20;
                const marginPercent = organization?.settings?.defaultProfitMarginPercentage || defaultMarginPercent;

                // Calcular costo estimado: Precio de venta - Margen de ganancia
                // Si precio = $1800 y margen = 20%, entonces costo = $1800 * (1 - 0.20) = $1440
                unitCost = itemDto.unitPrice * (1 - marginPercent / 100);
                totalCost = unitCost * itemDto.quantity;
              } catch (error) {
                console.warn(
                  `⚠️ No se pudo calcular costo estimado para producto temporal ${itemDto.description}: ${error.message}`,
                );
                // Usar margen por defecto si hay error
                const defaultMargin = 20;
                unitCost = itemDto.unitPrice * (1 - defaultMargin / 100);
                totalCost = unitCost * itemDto.quantity;
              }
            }

            return manager.create(InvoiceItem, {
              description: itemDto.description,
              quantity: itemDto.quantity,
              unitPrice: itemDto.unitPrice,
              discountPercentage: itemDto.discountPercentage || 0,
              discountAmount: itemDto.discountAmount || 0,
              unit: itemDto.unit,
              notes: itemDto.notes,
              productId: itemDto.productId,
              temporaryProductId: itemDto.temporaryProductId,
              // ✅ ASIGNAR COSTOS FIFO CALCULADOS
              unitCost,
              totalCost,
              // ✅ USAR EL IVA DEL PRODUCTO INDIVIDUAL (NO global de la factura)
              taxPercentage: itemTaxPercentage,
            });
          }),
        ),
      });

      // Guardar y procesar
      const savedInvoice = await manager.save(Invoice, invoice);

      const completeInvoice = await manager.findOne(Invoice, {
        where: { id: savedInvoice.id },
        relations: [
          'items',
          'customer',
          'createdBy',
          'items.product',
          'items.temporaryProduct',
        ],
      });

      if (!completeInvoice) {
        throw new BadRequestException('Error al crear la factura');
      }

      completeInvoice.calculateTotals();

      // 💰 NUEVO: Procesar saldo a favor del cliente si viene en el DTO o metadata
      const clientBalanceToApply =
        createInvoiceDto.clientBalanceApplied ||
        createInvoiceDto.metadata?.clientBalanceApplied ||
        0;

      if (clientBalanceToApply > 0) {

        try {
          // Descontar el saldo del cliente
          // IMPORTANTE: Pasar el manager para que use la misma transacción
          await this.clientBalanceService.useBalance(
            {
              clientId: createInvoiceDto.customerId,
              amount: clientBalanceToApply,
              description: `Aplicado a factura ${completeInvoice.number}`,
              relatedInvoiceId: completeInvoice.id,
            },
            createdById,
            manager, // ✅ Usar la misma transacción para evitar FK constraint
          );

          // 📝 CREAR REGISTRO DE PAGO PARA TRAZABILIDAD
          // Esto permite ver el pago con saldo a favor en el historial de pagos de la factura
          const balancePaymentNumber = await this.generatePaymentNumber(tenantId);
          const balancePayment = manager.create(Payment, {
            paymentNumber: balancePaymentNumber,
            amount: clientBalanceToApply,
            paymentMethod: PaymentMethod.CLIENT_BALANCE,
            paymentDate: new Date(),
            reference: `Saldo a favor aplicado - Factura ${completeInvoice.number}`,
            notes: `Pago realizado con saldo a favor del cliente. Saldo utilizado: $${clientBalanceToApply.toLocaleString()}`,
            invoiceId: completeInvoice.id,
            createdById,
            organizationId: tenantId,
          });
          await manager.save(Payment, balancePayment);

          // Registrar el saldo aplicado en la factura
          completeInvoice.clientBalanceApplied = clientBalanceToApply;
          completeInvoice.paidAmount += clientBalanceToApply;
          completeInvoice.balanceDue = completeInvoice.total - completeInvoice.paidAmount;

        } catch (error) {
          console.error(`❌ Error al aplicar saldo a favor: ${error.message}`);
          throw new BadRequestException(
            `No se pudo aplicar el saldo a favor: ${error.message}`,
          );
        }
      }

      // Consultar configuración de usuario para descuento automático
      const shouldAutoDeduct =
        await this.userPreferencesService.shouldAutoDeductInventory(
          createdById,
          tenantId,
        );

      // 🏦 NUEVO: Procesar pagos múltiples si vienen en metadata
      const metadata = createInvoiceDto.metadata;
      if (metadata?.isMultiplePayment && metadata?.multiplePayments?.length > 0) {

        await this.processMultiplePaymentsOnCreate(
          completeInvoice,
          metadata,
          manager,
          createdById,
          tenantId,
          shouldAutoDeduct,
        );
      } else {
        // Lógica original para pagos simples
        await this.applyBusinessLogicByStatus(
          completeInvoice,
          manager,
          shouldAutoDeduct,
          createInvoiceDto.bankAccountId,
          createdById,
          tenantId,
        );
      }

      return await manager.save(Invoice, completeInvoice);
    });
  }

  /**
   * 🏦 NUEVO MÉTODO: Procesar pagos múltiples durante la creación de factura
   * Maneja el flujo completo de pagos parciales/múltiples desde el punto de venta
   */
  private async processMultiplePaymentsOnCreate(
    invoice: Invoice,
    metadata: any,
    manager: any,
    createdById: string,
    organizationId: string,
    shouldAutoDeductInventory: boolean,
  ): Promise<void> {
    const multiplePayments = metadata.multiplePayments || [];
    const totalPaid = Number(metadata.totalPaid) || 0;
    const createCreditForRemaining = metadata.createCreditForRemaining || false;

    // ✅ CORREGIDO: Considerar el saldo a favor que ya fue aplicado
    // El saldo a favor ya fue procesado antes y está incluido en invoice.paidAmount
    const clientBalanceApplied = Number(metadata.clientBalanceApplied) || 0;
    const previouslyPaid = invoice.paidAmount || 0; // Incluye saldo a favor si se aplicó


    // 1. Crear registro de pago para cada método
    for (const paymentData of multiplePayments) {
      const amount = Number(paymentData.amount) || 0;
      if (amount <= 0) continue;

      const paymentNumber = await this.generatePaymentNumber(organizationId);

      // Mapear el método de pago del frontend al enum del backend
      const paymentMethod = this.mapPaymentMethod(paymentData.method);

      const payment = manager.create(Payment, {
        paymentNumber,
        amount,
        paymentMethod,
        paymentDate: new Date(),
        reference: `Pago inicial - Factura ${invoice.number}`,
        notes: paymentData.bankAccountName
          ? `Pago vía ${paymentData.bankAccountName}`
          : 'Pago registrado al crear factura',
        invoiceId: invoice.id,
        bankAccountId: paymentData.bankAccountId || null,
        createdById,
        organizationId,
      });

      await manager.save(Payment, payment);


      // 🏦 Actualizar saldo de cuenta bancaria usando el manager de la transacción
      if (paymentData.bankAccountId) {
        try {
          await manager
            .createQueryBuilder()
            .update('BankAccount')
            .set({
              currentBalance: () => `current_balance + ${amount}`,
            })
            .where('id = :id', { id: paymentData.bankAccountId })
            .andWhere('organization_id = :orgId', { orgId: organizationId })
            .execute();
        } catch (error) {
          console.warn(`   ⚠️ Error actualizando saldo de cuenta: ${error.message}`);
        }
      }
    }

    // 2. Actualizar montos de la factura
    // ✅ CORREGIDO: Sumar pagos múltiples al monto ya pagado (que incluye saldo a favor)
    const totalPaidWithBalance = previouslyPaid + totalPaid;
    const remainingBalance = Math.max(0, invoice.total - totalPaidWithBalance);
    invoice.paidAmount = Math.min(totalPaidWithBalance, invoice.total);
    invoice.balanceDue = remainingBalance;


    // 3. Determinar el estado de la factura y ajustar fecha de vencimiento
    if (remainingBalance <= 0) {
      invoice.status = InvoiceStatus.PAID;
    } else if (totalPaidWithBalance > 0) {
      // ✅ CORREGIDO: Usar totalPaidWithBalance para incluir saldo a favor
      invoice.status = InvoiceStatus.PARTIALLY_PAID;

      // 📅 IMPORTANTE: Para pagos parciales, dar plazo adicional para el saldo
      // Obtener cliente para usar sus términos de pago
      const customer = await manager.findOne('Customer', {
        where: { id: invoice.customerId },
      });
      invoice.dueDate = this.calculateDueDateForPartialPayment(customer);

    } else {
      invoice.status = InvoiceStatus.PENDING;
    }

    // 4. Crear crédito si hay saldo pendiente y se solicitó
    if (remainingBalance > 0 && createCreditForRemaining) {

      try {
        // Calcular fecha de vencimiento (30 días por defecto)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        // Generar descripción y notas detalladas para el crédito
        const { description: creditDescription, notes: creditNotes } = this.generateCreditDetailsFromInvoice(
          invoice,
          multiplePayments,
          totalPaid,
          remainingBalance,
        );

        // Crear el crédito directamente usando el manager de la transacción
        const credit = manager.create(CustomerCredit, {
          originalAmount: remainingBalance,
          paidAmount: 0,
          balanceDue: remainingBalance,
          status: CreditStatus.PENDING,
          dueDate: dueDate,
          description: creditDescription,
          notes: creditNotes,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          organizationId: organizationId,
          createdById: createdById,
        });

        const savedCredit = await manager.save(CustomerCredit, credit);


        // Actualizar el creditBalance del cliente
        await manager.increment(
          'Customer',
          { id: invoice.customerId },
          'creditBalance',
          remainingBalance,
        );

        // Actualizar metadata con información del crédito
        invoice.metadata = {
          ...invoice.metadata,
          creditCreated: true,
          creditId: savedCredit.id,
          creditAmount: remainingBalance,
        };
      } catch (error) {
        console.error(`   ❌ Error creando crédito: ${error.message}`);
        // No bloquear la creación de la factura
      }
    }

    // 5. Procesar inventario si corresponde
    if (shouldAutoDeductInventory && (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.PARTIALLY_PAID)) {
      const mainWarehouseId = await this.getMainWarehouseId(organizationId);

      for (const item of invoice.items) {
        if (item.productId) {
          try {
            await this.inventoryService.registerSale(
              item.productId,
              item.quantity,
              item.unitPrice,
              organizationId,
              createdById,
              'invoice_paid',
              invoice.id,
              {
                invoiceNumber: invoice.number,
                customerName: invoice.customer?.firstName || 'N/A',
              },
              mainWarehouseId,
              item.id, // NUEVO: Pasar invoice_item_id para trazabilidad FIFO
              manager.queryRunner, // ✅ CRÍTICO: Pasar queryRunner de la transacción
            );
          } catch (error) {
            console.error(`   ❌ Error descontando stock: ${error.message}`);
          }
        }
      }
    }

    // 6. Actualizar balance del cliente por los pagos realizados
    // IMPORTANTE: Usar manager directamente para evitar deadlock con la transacción
    if (totalPaid > 0) {
      const paymentAmount = Math.min(totalPaid, invoice.total);
      // Decrementar el currentBalance del cliente (lo que debe)
      await manager
        .createQueryBuilder()
        .update('Customer')
        .set({
          currentBalance: () => `GREATEST(0, "currentBalance" - ${paymentAmount})`,
        })
        .where('id = :id', { id: invoice.customerId })
        .execute();

    }

  }

  /**
   * Mapear método de pago del frontend al enum del backend
   */
  private mapPaymentMethod(method: string): PaymentMethod {
    const mapping: Record<string, PaymentMethod> = {
      cash: PaymentMethod.CASH,
      credit_card: PaymentMethod.CREDIT_CARD,
      debit_card: PaymentMethod.DEBIT_CARD,
      bank_transfer: PaymentMethod.BANK_TRANSFER,
      check: PaymentMethod.CHECK,
      credit: PaymentMethod.CREDIT,
      other: PaymentMethod.OTHER,
      // También manejar nombres en español o variantes
      efectivo: PaymentMethod.CASH,
      tarjeta_credito: PaymentMethod.CREDIT_CARD,
      tarjeta_debito: PaymentMethod.DEBIT_CARD,
      transferencia: PaymentMethod.BANK_TRANSFER,
      cheque: PaymentMethod.CHECK,
      credito: PaymentMethod.CREDIT,
    };

    return mapping[method?.toLowerCase()] || PaymentMethod.OTHER;
  }

  // ✅ NUEVO MÉTODO - Calcular status inicial solo si no viene en el DTO
  private calculateInitialStatus(paymentMethod: PaymentMethod): InvoiceStatus {
    switch (paymentMethod) {
      case PaymentMethod.CASH:
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
      case PaymentMethod.BANK_TRANSFER:
        return InvoiceStatus.PENDING; // Para confirmar después
      case PaymentMethod.CREDIT:
        return InvoiceStatus.PENDING;
      default:
        return InvoiceStatus.DRAFT;
    }
  }

  /**
   * Calcula la fecha de vencimiento según el método de pago
   *
   * Reglas de negocio:
   * - Pagos inmediatos (efectivo, tarjeta, transferencia): vence al final del día
   * - Crédito: según términos del cliente (o 30 días por defecto)
   * - Cheque: 15 días para permitir cobro
   * - Otros: 30 días por defecto
   *
   * IMPORTANTE: Para pagos inmediatos se establece fin del día actual
   * para evitar que aparezcan como "vencidas" inmediatamente.
   */
  private calculateDueDate(paymentMethod: PaymentMethod, customer: any): Date {
    const now = new Date();

    switch (paymentMethod) {
      case PaymentMethod.CASH:
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
      case PaymentMethod.BANK_TRANSFER:
        // Para pagos inmediatos: fin del día actual (23:59:59)
        // Esto evita que una factura creada hoy aparezca como "vencida"
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      case PaymentMethod.CREDIT:
        const creditDays = customer?.paymentTerms || 30;
        const creditDate = new Date(now);
        creditDate.setDate(creditDate.getDate() + creditDays);
        creditDate.setHours(23, 59, 59); // Fin del día de vencimiento
        return creditDate;

      case PaymentMethod.CHECK:
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + 15);
        checkDate.setHours(23, 59, 59);
        return checkDate;

      default:
        const defaultDate = new Date(now);
        defaultDate.setDate(defaultDate.getDate() + 30);
        defaultDate.setHours(23, 59, 59);
        return defaultDate;
    }
  }

  /**
   * Calcula la fecha de vencimiento para saldos pendientes (pagos parciales)
   * Siempre da un plazo de 30 días o los términos del cliente
   */
  private calculateDueDateForPartialPayment(customer: any): Date {
    const now = new Date();
    const days = customer?.paymentTerms || 30;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + days);
    dueDate.setHours(23, 59, 59);
    return dueDate;
  }

  /**
   * 📅 MÉTODO INTELIGENTE: Calcula la fecha de vencimiento según el contexto
   *
   * Reglas de negocio:
   * 1. Si hay pagos múltiples y es pago parcial → plazo extendido (30 días o términos cliente)
   * 2. Si es crédito → según términos del cliente
   * 3. Si es cheque → 15 días para cobro
   * 4. Si es pago inmediato (efectivo/tarjeta/transferencia) → fin del día actual
   * 5. Otros → 30 días por defecto
   *
   * IMPORTANTE: El backend es el dueño de esta lógica, ignora la fecha del frontend
   */
  private calculateSmartDueDate(
    paymentMethod: PaymentMethod,
    customer: any,
    metadata?: any,
    orgTimezone?: string,
  ): Date {
    const tz = orgTimezone || 'America/New_York';
    // Obtener "hoy" en el timezone de la organización
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // "YYYY-MM-DD"

    // Helper: crear Date a partir de "YYYY-MM-DD" + días adicionales
    const addDays = (dateStr: string, days: number): Date => {
      const d = new Date(dateStr + 'T12:00:00'); // Mediodía para evitar edge cases
      d.setDate(d.getDate() + days);
      return d;
    };

    // "Hoy" como Date (mediodía para evitar offset UTC)
    const todayDate = new Date(todayStr + 'T12:00:00');

    // 📅 CASO 1: Pagos múltiples con saldo pendiente → plazo extendido
    if (metadata?.isMultiplePayment) {
      const totalPaid = Number(metadata.totalPaid) || 0;
      const remainingBalance = Number(metadata.remainingBalance) || 0;

      if (remainingBalance > 0 || metadata.createCreditForRemaining) {
        const days = customer?.paymentTerms || 30;
        const dueDate = addDays(todayStr, days);
        return dueDate;
      }

      return todayDate;
    }

    // 📅 CASO 2: Método de pago específico
    switch (paymentMethod) {
      case PaymentMethod.CASH:
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
      case PaymentMethod.BANK_TRANSFER:
        return todayDate;

      case PaymentMethod.CREDIT: {
        const creditDays = customer?.paymentTerms || 30;
        const creditDate = addDays(todayStr, creditDays);
        return creditDate;
      }

      case PaymentMethod.CHECK: {
        const checkDate = addDays(todayStr, 15);
        return checkDate;
      }

      default: {
        const defaultDate = addDays(todayStr, 30);
        return defaultDate;
      }
    }
  }

  // ✅ NUEVO MÉTODO - Generar número de pago único
  private async generatePaymentNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Contar pagos existentes para esta organización en el año actual
    const count = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.organizationId = :organizationId', { organizationId })
      .andWhere('payment.paymentNumber LIKE :pattern', { pattern: `PAY-${year}-%` })
      .getCount();

    // Formato: PAY-YYYY-XXXXXX (donde X es secuencial + random para evitar colisiones)
    const sequential = (count + 1).toString().padStart(4, '0');
    return `PAY-${year}-${sequential}${randomPart}`;
  }

  // ✅ NUEVO MÉTODO - Aplicar lógica de negocio según status
  // private async applyBusinessLogicByStatus(
  //   invoice: Invoice,
  //   manager: any,
  // ): Promise<void> {
  //   switch (invoice.status) {
  //     case InvoiceStatus.PAID:
  //       // Marcar como pagada completamente
  //       invoice.paidAmount = invoice.total;
  //       invoice.balanceDue = 0;

  //       // Reducir stock automáticamente
  //       for (const item of invoice.items) {
  //         if (item.productId) {
  //           await this.productsService.reduceStockForSale(
  //             item.productId,
  //             item.quantity,
  //           );
  //         }
  //       }

  //       // Actualizar balance del cliente
  //       await this.customersService.updateBalance(
  //         invoice.customerId,
  //         invoice.total,
  //         'subtract',
  //       );
  //       break;

  //     case InvoiceStatus.PENDING:
  //       // Reducir stock pero mantener como pendiente de pago
  //       for (const item of invoice.items) {
  //         if (item.productId) {
  //           await this.productsService.reduceStockForSale(
  //             item.productId,
  //             item.quantity,
  //           );
  //         }
  //       }
  //       break;

  //     case InvoiceStatus.DRAFT:
  //       // No reducir stock ni actualizar balances
  //       break;

  //     default:
  //   }
  // }

  private async applyBusinessLogicByStatus(
    invoice: Invoice,
    manager: any,
    shouldAutoDeductInventory: boolean = false,
    bankAccountId?: string,
    createdById?: string,
    organizationId?: string,
  ): Promise<void> {
    switch (invoice.status) {
      case InvoiceStatus.PAID:

        // ✅ CORREGIDO: Calcular el monto real a pagar (considerando saldo a favor ya aplicado)
        // Si ya se aplicó saldo a favor, paidAmount ya tiene ese valor
        const previouslyPaidAmount = invoice.paidAmount || 0; // Incluye saldo a favor si se aplicó
        const remainingToPay = invoice.total - previouslyPaidAmount;


        // Marcar como pagada completamente
        invoice.paidAmount = invoice.total;
        invoice.balanceDue = 0;

        // 🏦 Registrar el pago SOLO por el monto restante (no incluir el saldo a favor ya registrado)
        if (remainingToPay > 0) {
          // Generar número de pago único
          const paymentNumber = await this.generatePaymentNumber(organizationId || invoice.organizationId);

          const payment = manager.create(Payment, {
            paymentNumber,
            amount: remainingToPay, // ✅ CORREGIDO: Solo el monto restante después del saldo a favor
            paymentMethod: invoice.paymentMethod,
            paymentDate: new Date(),
            reference: `Pago completo - Factura ${invoice.number}`,
            notes: 'Pago registrado automáticamente al crear factura',
            invoiceId: invoice.id,
            bankAccountId: bankAccountId || null,
            createdById: createdById || invoice.createdById,
            organizationId: organizationId || invoice.organizationId,
          });

          await manager.save(Payment, payment);

          // 🏦 Actualizar saldo de la cuenta bancaria SOLO con el monto del pago real
          if (bankAccountId) {
            try {
              await this.bankAccountsService.updateBalanceById(
                bankAccountId,
                remainingToPay, // ✅ CORREGIDO: Solo actualizar con el monto real pagado
                organizationId || invoice.organizationId,
              );
            } catch (error) {
              console.warn(`⚠️ Error actualizando saldo de cuenta: ${error.message}`);
            }
          }
        } else {
        }

        // Solo reducir stock si está habilitado usando FIFO
        if (shouldAutoDeductInventory) {
          // Obtener almacén principal para el descuento
          const mainWarehouseId = await this.getMainWarehouseId(
            invoice.organizationId,
          );

          for (const item of invoice.items) {
            if (item.productId) {
              try {
                await this.inventoryService.registerSale(
                  item.productId,
                  item.quantity,
                  item.unitPrice,
                  invoice.organizationId,
                  invoice.createdById,
                  'invoice_paid',
                  invoice.id,
                  {
                    invoiceNumber: invoice.number,
                    customerName: invoice.customer?.firstName || 'N/A',
                  },
                  mainWarehouseId, // 🏪 Usar almacén principal
                  item.id, // NUEVO: Pasar invoice_item_id para trazabilidad FIFO
                  manager.queryRunner, // ✅ CRÍTICO: Pasar queryRunner de la transacción
                );
              } catch (error) {
                console.error(
                  `❌ Error descontando stock FIFO para producto ${item.productId}:`,
                  error,
                );
                throw new BadRequestException(
                  `Error procesando inventario para ${item.description}: ${error.message}`,
                );
              }
            }
          }
        }

        // Actualizar balance del cliente
        await this.customersService.updateBalance(
          invoice.customerId,
          invoice.total,
          'subtract',
        );
        break;

      case InvoiceStatus.PENDING:
        // Solo reducir stock si está habilitado usando FIFO
        if (shouldAutoDeductInventory) {
          // Obtener almacén principal para el descuento
          const mainWarehouseId = await this.getMainWarehouseId(
            invoice.organizationId,
          );

          for (const item of invoice.items) {
            if (item.productId) {
              try {
                await this.inventoryService.registerSale(
                  item.productId,
                  item.quantity,
                  item.unitPrice,
                  invoice.organizationId,
                  invoice.createdById,
                  'invoice_paid',
                  invoice.id,
                  {
                    invoiceNumber: invoice.number,
                    customerName: invoice.customer?.firstName || 'N/A',
                  },
                  mainWarehouseId, // 🏪 Usar almacén principal
                  item.id, // NUEVO: Pasar invoice_item_id para trazabilidad FIFO
                  manager.queryRunner, // ✅ CRÍTICO: Pasar queryRunner de la transacción
                );
              } catch (error) {
                console.error(
                  `❌ Error descontando stock FIFO para producto ${item.productId}:`,
                  error,
                );
                throw new BadRequestException(
                  `Error procesando inventario para ${item.description}: ${error.message}`,
                );
              }
            }
          }
        }
        break;

      case InvoiceStatus.DRAFT:
        // No reducir stock ni actualizar balances
        break;

      default:
    }
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
      bankAccountId,
      bankAccountName,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    // const queryBuilder = this.invoiceRepository
    //   .createQueryBuilder('invoice')
    //   .leftJoinAndSelect('invoice.customer', 'customer')
    //   .leftJoinAndSelect('invoice.createdBy', 'createdBy')
    //   .leftJoinAndSelect('invoice.items', 'items');

    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      // ✅ AGREGADO: Incluir pagos con su cuenta bancaria para mostrar método específico (Nequi, Daviplata, etc.)
      .leftJoinAndSelect('invoice.payments', 'payments')
      .leftJoinAndSelect('payments.bankAccount', 'bankAccount');

    // ✅ MULTITENANT FIX: Filtrar por organización
    queryBuilder.where('invoice.organizationId = :organizationId', {
      organizationId: tenantId,
    });

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

    // ✅ Filtrar por ID de cuenta bancaria (legacy)
    if (bankAccountId) {
      queryBuilder.andWhere('payments.bank_account_id = :bankAccountId', {
        bankAccountId,
      });
    }

    // ✅ NUEVO: Filtrar por NOMBRE de cuenta bancaria (Nequi, Bancolombia, Efectivo, etc.)
    if (bankAccountName) {
      queryBuilder.andWhere('bankAccount.name ILIKE :bankAccountName', {
        bankAccountName: `%${bankAccountName}%`,
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
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const invoice = await this.invoiceRepository.findOne({
      where: { id, organizationId: tenantId },
      relations: ['items', 'customer', 'createdBy', 'items.product', 'payments', 'payments.bankAccount', 'creditNotes', 'creditNotes.items'], // ✅ Incluye product, payments con bankAccount y creditNotes
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return invoice;
  }

  async findByNumber(number: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { number },
      relations: ['items', 'customer', 'createdBy', 'items.product', 'payments', 'payments.bankAccount'],
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

  // async confirm(id: string): Promise<Invoice> {
  //   const invoice = await this.findOne(id);

  //   if (invoice.status !== InvoiceStatus.DRAFT) {
  //     throw new BadRequestException(
  //       'Solo se pueden confirmar facturas en borrador',
  //     );
  //   }

  //   return this.dataSource.transaction(async (manager) => {
  //     // Reducir stock de productos
  //     for (const item of invoice.items) {
  //       if (item.productId) {
  //         await this.productsService.reduceStockForSale(
  //           item.productId,
  //           item.quantity,
  //         );
  //       }
  //     }

  //     // Cambiar estado a pendiente
  //     invoice.status = InvoiceStatus.PENDING;
  //     await manager.save(Invoice, invoice);

  //     return this.findOne(id);
  //   });
  // }

  async confirm(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden confirmar facturas en borrador',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // ❌ COMENTADO: Reducir stock de productos
      // for (const item of invoice.items) {
      //   if (item.productId) {
      //     await this.productsService.reduceStockForSale(
      //       item.productId,
      //       item.quantity,
      //     );
      //   }
      // }

      // Cambiar estado a pendiente
      invoice.status = InvoiceStatus.PENDING;
      await manager.save(Invoice, invoice);

      return this.findOne(id);
    });
  }

  async generateMissingPaymentRecord(id: string, createdById: string): Promise<Invoice> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }


    const invoice = await this.invoiceRepository.findOne({
      where: { id, organizationId: tenantId },
      relations: ['payments', 'payments.bankAccount'],
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }


    // Solo procesar facturas que tienen paidAmount > 0 pero no tienen registros de pago
    if (invoice.paidAmount <= 0) {
      throw new BadRequestException('La factura no tiene pagos registrados en paidAmount');
    }

    if (invoice.payments && invoice.payments.length > 0) {
      throw new BadRequestException('La factura ya tiene registros de pago');
    }

    // Crear registro de pago retroactivo de forma segura
    return this.dataSource.transaction(async (manager) => {
      // Generar número de pago único
      const paymentNumber = await this.generatePaymentNumber(tenantId);

      const payment = manager.create(Payment, {
        paymentNumber,
        amount: invoice.paidAmount,
        paymentMethod: invoice.paymentMethod || PaymentMethod.CASH, // Usar método de pago de la factura o efectivo por defecto
        paymentDate: invoice.updatedAt, // Usar fecha de última actualización
        reference: `Retroactivo-${invoice.number}`,
        notes: 'Registro de pago generado retroactivamente para mantener trazabilidad',
        invoiceId: id,
        createdById,
        organizationId: tenantId,
      });

      await manager.save(Payment, payment);

      // NO modificar ningún campo de la factura, solo añadir el registro de pago
      return this.findOne(id);
    });
  }

  async addPayment(id: string, paymentDto: AddPaymentDto, createdById: string): Promise<Invoice> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

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

    // Validar campos multi-moneda: si uno está presente, los 3 deben estar
    if (paymentDto.paymentCurrency) {
      if (!paymentDto.paymentCurrencyAmount || !paymentDto.exchangeRate) {
        throw new BadRequestException(
          'Cuando se especifica paymentCurrency, paymentCurrencyAmount y exchangeRate son requeridos',
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Generar número de pago único
      const paymentNumber = await this.generatePaymentNumber(tenantId);

      // 1. Crear registro de pago
      const payment = manager.create(Payment, {
        paymentNumber,
        amount: paymentDto.amount,
        paymentMethod: paymentDto.paymentMethod,
        paymentDate: paymentDto.paymentDate ? new Date(paymentDto.paymentDate) : new Date(),
        reference: paymentDto.reference,
        notes: paymentDto.notes,
        invoiceId: id,
        bankAccountId: paymentDto.bankAccountId || null,
        createdById,
        organizationId: tenantId,
        // Multi-currency fields
        paymentCurrency: paymentDto.paymentCurrency || null,
        paymentCurrencyAmount: paymentDto.paymentCurrencyAmount || null,
        exchangeRate: paymentDto.exchangeRate || null,
      });

      await manager.save(Payment, payment);

      // 🏦 2. Actualizar saldo de la cuenta bancaria si se especificó
      if (paymentDto.bankAccountId) {
        try {
          await this.bankAccountsService.updateBalanceById(
            paymentDto.bankAccountId,
            paymentDto.amount,
            tenantId,
          );
        } catch (error) {
          console.warn(`⚠️ Error actualizando saldo de cuenta: ${error.message}`);
        }
      }

      // 3. Actualizar montos de la factura usando UPDATE directo para evitar problemas de relación
      const newPaidAmount = invoice.paidAmount + paymentDto.amount;
      const newBalanceDue = invoice.total - newPaidAmount;

      let newStatus: InvoiceStatus;
      if (newBalanceDue <= 0) {
        newStatus = InvoiceStatus.PAID;
      } else {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      // Usar UPDATE directo para evitar que TypeORM gestione la relación payments
      await manager.update(Invoice, { id }, {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
      });

      // 4. Actualizar balance del cliente
      await this.customersService.updateBalance(
        invoice.customerId,
        paymentDto.amount,
        'subtract',
      );

      // 5. SINCRONIZACIÓN BIDIRECCIONAL: Actualizar crédito asociado si existe
      // Esto es CRÍTICO para mantener consistencia cuando se paga desde facturas
      try {
        const associatedCredit = await manager.findOne(CustomerCredit, {
          where: { invoiceId: id },
        });

        if (associatedCredit) {
          // El crédito representa el saldo pendiente de la factura
          // Por lo tanto, el balanceDue del crédito debe ser igual al de la factura
          const creditNewBalanceDue = newBalanceDue;
          const creditNewPaidAmount = Math.max(0, Number(associatedCredit.originalAmount) - creditNewBalanceDue);

          let creditNewStatus: CreditStatus;
          if (creditNewBalanceDue <= 0) {
            creditNewStatus = CreditStatus.PAID;
          } else if (creditNewPaidAmount > 0) {
            creditNewStatus = CreditStatus.PARTIALLY_PAID;
          } else {
            creditNewStatus = associatedCredit.status;
          }

          await manager.update(CustomerCredit, { id: associatedCredit.id }, {
            paidAmount: creditNewPaidAmount,
            balanceDue: creditNewBalanceDue,
            status: creditNewStatus,
          });

          // SINCRONIZACIÓN DE HISTORIAL: Crear registros de pago en el crédito
          // Solo si este pago NO vino de una sincronización desde créditos (evitar loop)
          const isFromCreditSync = paymentDto.reference?.startsWith(SYNC_FROM_CREDIT_PREFIX);

          if (!isFromCreditSync) {
            // Mapear método de pago de factura a string de crédito
            const creditPaymentMethod = this.mapInvoicePaymentMethodToCredit(paymentDto.paymentMethod);

            // Crear CreditPayment
            const creditPayment = manager.create(CreditPayment, {
              amount: paymentDto.amount,
              paymentMethod: creditPaymentMethod,
              paymentDate: paymentDto.paymentDate ? new Date(paymentDto.paymentDate) : new Date(),
              reference: `${SYNC_FROM_INVOICE_PREFIX}${payment.id}`,
              notes: paymentDto.notes ? `[Desde Facturas] ${paymentDto.notes}` : '[Pago sincronizado desde módulo de Facturas]',
              creditId: associatedCredit.id,
              bankAccountId: paymentDto.bankAccountId || null,
              organizationId: tenantId,
              createdById,
            });

            await manager.save(CreditPayment, creditPayment);

            // Crear CreditTransaction
            const creditTransaction = manager.create(CreditTransaction, {
              creditId: associatedCredit.id,
              type: CreditTransactionType.PAYMENT,
              amount: paymentDto.amount,
              description: paymentDto.notes ? `[Desde Facturas] ${paymentDto.notes}` : 'Pago sincronizado desde módulo de Facturas',
              balanceAfter: creditNewBalanceDue,
              paymentMethod: creditPaymentMethod,
              bankAccountId: paymentDto.bankAccountId || null,
              organizationId: tenantId,
              createdById,
            });

            await manager.save(CreditTransaction, creditTransaction);
          }

        }
      } catch (syncError) {
        console.error(`❌ [Invoice] Error al sincronizar crédito asociado:`, syncError.message);
        // No lanzar error para no afectar el pago de la factura
      }

      return this.findOne(id);
    });
  }

  /**
   * Aplicar saldo a favor del cliente a una factura
   * @param invoiceId ID de la factura
   * @param createdById ID del usuario que realiza la operación
   * @param amount Monto a aplicar (opcional, por defecto aplica el mínimo entre saldo y deuda)
   * @returns La factura actualizada con información del saldo aplicado
   */
  async applyClientBalance(
    invoiceId: string,
    createdById: string,
    amount?: number,
  ): Promise<{
    invoice: Invoice;
    balanceUsed: number;
    remainingBalance: number;
    remainingDebt: number;
  }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const invoice = await this.findOne(invoiceId);

    // Validaciones
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('La factura ya está pagada completamente');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('No se puede aplicar saldo a una factura cancelada');
    }

    // Obtener saldo disponible del cliente
    const clientBalanceInfo = await this.clientBalanceService.getAvailableBalance(invoice.customerId);

    if (!clientBalanceInfo.hasBalance) {
      throw new BadRequestException('El cliente no tiene saldo a favor disponible');
    }

    const availableBalance = clientBalanceInfo.amount;
    const invoiceDebt = Number(invoice.balanceDue);

    // Calcular monto a aplicar
    let balanceToUse: number;
    if (amount !== undefined && amount > 0) {
      if (amount > availableBalance) {
        throw new BadRequestException(
          `Monto solicitado ($${amount.toLocaleString()}) excede el saldo disponible ($${availableBalance.toLocaleString()})`,
        );
      }
      if (amount > invoiceDebt) {
        throw new BadRequestException(
          `Monto solicitado ($${amount.toLocaleString()}) excede la deuda de la factura ($${invoiceDebt.toLocaleString()})`,
        );
      }
      balanceToUse = amount;
    } else {
      // Por defecto, usar el mínimo entre saldo disponible y deuda
      balanceToUse = Math.min(availableBalance, invoiceDebt);
    }


    return this.dataSource.transaction(async (manager) => {
      // 1. Usar el saldo del cliente (registra transacción en historial de saldo)
      await this.clientBalanceService.useBalance(
        {
          clientId: invoice.customerId,
          amount: balanceToUse,
          description: `Aplicado a factura #${invoice.number}`,
          relatedInvoiceId: invoiceId,
        },
        createdById,
      );

      // 2. Generar número de pago único
      const paymentNumber = await this.generatePaymentNumber(tenantId);

      // 3. Crear registro de pago con método CLIENT_BALANCE
      const payment = manager.create(Payment, {
        paymentNumber,
        amount: balanceToUse,
        paymentMethod: PaymentMethod.CLIENT_BALANCE,
        paymentDate: new Date(),
        reference: `SALDO-${invoice.customerId.substring(0, 8)}`,
        notes: `Pago con saldo a favor del cliente`,
        invoiceId,
        createdById,
        organizationId: tenantId,
      });

      await manager.save(Payment, payment);

      // 4. Actualizar montos de la factura
      const newPaidAmount = Number(invoice.paidAmount) + balanceToUse;
      const newBalanceDue = Number(invoice.total) - newPaidAmount;

      let newStatus: InvoiceStatus;
      if (newBalanceDue <= 0) {
        newStatus = InvoiceStatus.PAID;
      } else {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      await manager.update(Invoice, { id: invoiceId }, {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
      });

      // 5. Actualizar balance del cliente (deuda)
      await this.customersService.updateBalance(
        invoice.customerId,
        balanceToUse,
        'subtract',
      );

      // 6. SINCRONIZACIÓN: Actualizar crédito asociado si existe
      try {
        const associatedCredit = await manager.findOne(CustomerCredit, {
          where: { invoiceId },
        });

        if (associatedCredit) {
          const creditNewBalanceDue = newBalanceDue;
          const creditNewPaidAmount = Math.max(0, Number(associatedCredit.originalAmount) - creditNewBalanceDue);

          let creditNewStatus: CreditStatus;
          if (creditNewBalanceDue <= 0) {
            creditNewStatus = CreditStatus.PAID;
          } else if (creditNewPaidAmount > 0) {
            creditNewStatus = CreditStatus.PARTIALLY_PAID;
          } else {
            creditNewStatus = associatedCredit.status;
          }

          await manager.update(CustomerCredit, { id: associatedCredit.id }, {
            paidAmount: creditNewPaidAmount,
            balanceDue: creditNewBalanceDue,
            status: creditNewStatus,
          });

          // Crear CreditPayment y CreditTransaction para trazabilidad
          const creditPayment = manager.create(CreditPayment, {
            amount: balanceToUse,
            paymentMethod: 'saldo_favor',
            paymentDate: new Date(),
            reference: `${SYNC_FROM_INVOICE_PREFIX}${payment.id}`,
            notes: '[Desde Facturas] Pago con saldo a favor del cliente',
            creditId: associatedCredit.id,
            organizationId: tenantId,
            createdById,
          });

          await manager.save(CreditPayment, creditPayment);

          const creditTransaction = manager.create(CreditTransaction, {
            creditId: associatedCredit.id,
            type: CreditTransactionType.BALANCE_USED,
            amount: balanceToUse,
            description: `Saldo a favor aplicado desde factura #${invoice.number}`,
            balanceAfter: creditNewBalanceDue,
            paymentMethod: 'saldo_favor',
            organizationId: tenantId,
            createdById,
          });

          await manager.save(CreditTransaction, creditTransaction);

        }
      } catch (syncError) {
        console.error(`❌ [Invoice] Error al sincronizar crédito:`, syncError.message);
        // No lanzar error para no afectar la operación principal
      }


      const updatedInvoice = await this.findOne(invoiceId);

      return {
        invoice: updatedInvoice,
        balanceUsed: balanceToUse,
        remainingBalance: availableBalance - balanceToUse,
        remainingDebt: newBalanceDue,
      };
    });
  }

  /**
   * Agregar múltiples pagos a una factura en una sola transacción
   * Permite pagar con varios métodos de pago (Ej: $100,000 Nequi + $200,000 Efectivo)
   */
  async addMultiplePayments(
    id: string,
    multiPaymentDto: AddMultiplePaymentsDto,
    createdById: string,
  ): Promise<{ invoice: Invoice; payments: Payment[]; remainingBalance: number; creditCreated: boolean; creditId?: string | null }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const invoice = await this.findOne(id);

    // Validaciones
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('La factura ya está pagada completamente');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('No se puede agregar pago a una factura cancelada');
    }

    // Calcular total de pagos
    const totalPaymentAmount = multiPaymentDto.payments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );

    const remainingBalance = invoice.balanceDue;

    // Validar que no exceda el saldo (a menos que se permita crear crédito)
    if (totalPaymentAmount > remainingBalance && !multiPaymentDto.createCreditForRemaining) {
      throw new BadRequestException(
        `El total de pagos ($${totalPaymentAmount.toLocaleString()}) excede el saldo pendiente ($${remainingBalance.toLocaleString()}). ` +
        `Ajuste los montos o permita crear crédito para el excedente.`,
      );
    }


    return this.dataSource.transaction(async (manager) => {
      const createdPayments: Payment[] = [];
      const paymentDate = multiPaymentDto.paymentDate
        ? new Date(multiPaymentDto.paymentDate)
        : new Date();

      // 1. Crear cada registro de pago y actualizar saldo de cuentas bancarias
      for (const paymentItem of multiPaymentDto.payments) {
        // Generar número de pago único para cada pago
        const paymentNumber = await this.generatePaymentNumber(tenantId);

        const payment = manager.create(Payment, {
          paymentNumber,
          amount: paymentItem.amount,
          paymentMethod: paymentItem.paymentMethod,
          paymentDate,
          reference: paymentItem.reference,
          notes: paymentItem.notes || multiPaymentDto.generalNotes,
          invoiceId: id,
          bankAccountId: paymentItem.bankAccountId || null,
          createdById,
          organizationId: tenantId,
          // Multi-currency fields
          paymentCurrency: paymentItem.paymentCurrency || null,
          paymentCurrencyAmount: paymentItem.paymentCurrencyAmount || null,
          exchangeRate: paymentItem.exchangeRate || null,
        });

        const savedPayment = await manager.save(Payment, payment);
        createdPayments.push(savedPayment);

        // 🏦 Actualizar saldo de la cuenta bancaria usando el manager de la transacción
        if (paymentItem.bankAccountId) {
          try {
            await manager
              .createQueryBuilder()
              .update('BankAccount')
              .set({
                currentBalance: () => `current_balance + ${paymentItem.amount}`,
              })
              .where('id = :id', { id: paymentItem.bankAccountId })
              .andWhere('organization_id = :orgId', { orgId: tenantId })
              .execute();
          } catch (error) {
            console.warn(`   ⚠️ Error actualizando saldo de cuenta: ${error.message}`);
            // No bloquear el pago, solo advertir
          }
        }

      }

      // 2. Calcular nuevos montos de la factura
      // Si el pago excede el saldo, solo aplicamos hasta el saldo pendiente
      const effectivePayment = Math.min(totalPaymentAmount, remainingBalance);
      const newPaidAmount = invoice.paidAmount + effectivePayment;
      const newBalanceDue = Math.max(0, invoice.total - newPaidAmount);

      // 3. Determinar nuevo estado
      let newStatus: InvoiceStatus;
      if (newBalanceDue <= 0) {
        newStatus = InvoiceStatus.PAID;
      } else {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      // 4. Actualizar factura
      await manager.update(Invoice, { id }, {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
      });

      // 5. Actualizar balance del cliente
      // IMPORTANTE: Usar manager directamente para evitar deadlock con la transacción
      await manager
        .createQueryBuilder()
        .update('Customer')
        .set({
          currentBalance: () => `GREATEST(0, "currentBalance" - ${effectivePayment})`,
        })
        .where('id = :id', { id: invoice.customerId })
        .execute();


      // 6. SINCRONIZACIÓN BIDIRECCIONAL: Actualizar crédito existente si lo hay
      // Esto es CRÍTICO para mantener consistencia cuando se paga desde facturas
      try {
        const existingCredit = await manager.findOne(CustomerCredit, {
          where: { invoiceId: id },
        });

        if (existingCredit) {
          // El crédito representa el saldo pendiente de la factura
          // Por lo tanto, el balanceDue del crédito debe ser igual al de la factura
          const creditNewBalanceDue = newBalanceDue;
          const creditNewPaidAmount = Math.max(0, Number(existingCredit.originalAmount) - creditNewBalanceDue);

          let creditNewStatus: CreditStatus;
          if (creditNewBalanceDue <= 0) {
            creditNewStatus = CreditStatus.PAID;
          } else if (creditNewPaidAmount > 0) {
            creditNewStatus = CreditStatus.PARTIALLY_PAID;
          } else {
            creditNewStatus = existingCredit.status;
          }

          await manager.update(CustomerCredit, { id: existingCredit.id }, {
            paidAmount: creditNewPaidAmount,
            balanceDue: creditNewBalanceDue,
            status: creditNewStatus,
          });

          // SINCRONIZACIÓN DE HISTORIAL: Crear registros de pago en el crédito
          // Crear un registro consolidado por el total de los pagos múltiples
          if (createdPayments.length > 0 && totalPaymentAmount > 0) {
            // Crear CreditPayment consolidado
            const creditPayment = manager.create(CreditPayment, {
              amount: Math.min(totalPaymentAmount, remainingBalance), // Solo el monto efectivo
              paymentMethod: 'multiple', // Indicar que fueron pagos múltiples
              paymentDate: paymentDate,
              reference: `${SYNC_FROM_INVOICE_PREFIX}MULTI-${createdPayments[0].id}`,
              notes: `[Desde Facturas] Pagos múltiples sincronizados (${createdPayments.length} pagos)`,
              creditId: existingCredit.id,
              bankAccountId: null,
              organizationId: tenantId,
              createdById,
            });

            await manager.save(CreditPayment, creditPayment);

            // Crear CreditTransaction consolidado
            const creditTransaction = manager.create(CreditTransaction, {
              creditId: existingCredit.id,
              type: CreditTransactionType.PAYMENT,
              amount: Math.min(totalPaymentAmount, remainingBalance),
              description: `[Desde Facturas] Pagos múltiples sincronizados (${createdPayments.length} pagos)`,
              balanceAfter: creditNewBalanceDue,
              paymentMethod: 'multiple',
              bankAccountId: null,
              organizationId: tenantId,
              createdById,
            });

            await manager.save(CreditTransaction, creditTransaction);
          }

        }
      } catch (syncError) {
        console.error(`❌ [Invoice] Error al sincronizar crédito existente:`, syncError.message);
        // No lanzar error para no afectar el pago de la factura
      }

      // 7. Crear crédito NUEVO si el pago es parcial y se solicita (y no existe crédito previo)
      let creditCreated = false;
      let creditId: string | null = null;

      // Caso 1: Pago parcial - crear crédito por el saldo restante
      if (newBalanceDue > 0 && multiPaymentDto.createCreditForRemaining) {

        try {
          // Calcular fecha de vencimiento (30 días por defecto)
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);

          // Generar descripción y notas detalladas para el crédito
          // Convertir formato de multiPaymentDto.payments al formato esperado
          const paymentsForDetails = multiPaymentDto.payments.map(p => ({
            amount: p.amount,
            method: p.paymentMethod,
            bankAccountName: null, // Se podría obtener si es necesario
          }));

          const { description: creditDescription, notes: creditNotes } = this.generateCreditDetailsFromInvoice(
            invoice,
            paymentsForDetails,
            totalPaymentAmount,
            newBalanceDue,
            multiPaymentDto.generalNotes,
          );

          // Crear el crédito directamente usando el manager de la transacción
          const credit = manager.create(CustomerCredit, {
            originalAmount: newBalanceDue,
            paidAmount: 0,
            balanceDue: newBalanceDue,
            status: CreditStatus.PENDING,
            dueDate: dueDate,
            description: creditDescription,
            notes: creditNotes,
            customerId: invoice.customerId,
            invoiceId: id,
            organizationId: tenantId,
            createdById: createdById,
          });

          const savedCredit = await manager.save(CustomerCredit, credit);

          // Actualizar el creditBalance del cliente
          await manager.increment(
            'Customer',
            { id: invoice.customerId },
            'creditBalance',
            newBalanceDue,
          );

          creditCreated = true;
          creditId = savedCredit.id;
        } catch (error) {
          console.error(`   ❌ Error creando crédito: ${error.message}`);
          // No bloquear el pago, solo advertir
        }
      }

      // Caso 2: Excedente de pago - crear crédito a favor del cliente
      if (totalPaymentAmount > remainingBalance) {
        const excessAmount = totalPaymentAmount - remainingBalance;
        // TODO: Manejar créditos a favor (saldo positivo del cliente)
      }

      const updatedInvoice = await this.findOne(id);

      return {
        invoice: updatedInvoice,
        payments: createdPayments,
        remainingBalance: newBalanceDue,
        creditCreated,
        creditId,
      };
    });
  }

  /**
   * Obtener todos los pagos de una factura
   */
  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Verificar que la factura existe y pertenece al tenant
    await this.findOne(invoiceId);

    return this.paymentRepository.find({
      where: { invoiceId, organizationId: tenantId },
      relations: ['bankAccount', 'createdBy'],
      order: { paymentDate: 'DESC' },
    });
  }

  /**
   * Eliminar un pago específico (solo si la factura no está pagada)
   */
  async removePayment(invoiceId: string, paymentId: string): Promise<Invoice> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const invoice = await this.findOne(invoiceId);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('No se pueden modificar pagos de una factura cancelada');
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, invoiceId, organizationId: tenantId },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Eliminar el pago
      await manager.remove(Payment, payment);

      // 2. Recalcular montos de la factura
      const newPaidAmount = Math.max(0, invoice.paidAmount - payment.amount);
      const newBalanceDue = invoice.total - newPaidAmount;

      // 3. Determinar nuevo estado
      let newStatus: InvoiceStatus;
      if (newPaidAmount <= 0) {
        newStatus = InvoiceStatus.PENDING;
      } else if (newBalanceDue <= 0) {
        newStatus = InvoiceStatus.PAID;
      } else {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      // 4. Actualizar factura
      await manager.update(Invoice, { id: invoiceId }, {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
      });

      // 5. Restaurar balance del cliente
      await this.customersService.updateBalance(
        invoice.customerId,
        payment.amount,
        'add',
      );

      // 6. SINCRONIZACIÓN BIDIRECCIONAL: Actualizar crédito asociado si existe
      try {
        const associatedCredit = await manager.findOne(CustomerCredit, {
          where: { invoiceId },
        });

        if (associatedCredit) {
          // El crédito representa el saldo pendiente de la factura
          const creditNewBalanceDue = newBalanceDue;
          const creditNewPaidAmount = Math.max(0, Number(associatedCredit.originalAmount) - creditNewBalanceDue);

          let creditNewStatus: CreditStatus;
          if (creditNewBalanceDue <= 0) {
            creditNewStatus = CreditStatus.PAID;
          } else if (creditNewPaidAmount > 0) {
            creditNewStatus = CreditStatus.PARTIALLY_PAID;
          } else {
            creditNewStatus = CreditStatus.PENDING;
          }

          await manager.update(CustomerCredit, { id: associatedCredit.id }, {
            paidAmount: creditNewPaidAmount,
            balanceDue: creditNewBalanceDue,
            status: creditNewStatus,
          });

        }
      } catch (syncError) {
        console.error(`❌ [Invoice] Error al sincronizar crédito tras eliminar pago:`, syncError.message);
      }


      return this.findOne(invoiceId);
    });
  }

  // async cancel(id: string): Promise<Invoice> {
  //   const invoice = await this.findOne(id);

  //   if (invoice.status === InvoiceStatus.PAID) {
  //     throw new BadRequestException('No se puede cancelar una factura pagada');
  //   }

  //   return this.dataSource.transaction(async (manager) => {
  //     // Si la factura estaba confirmada, restaurar stock
  //     if (
  //       invoice.status === InvoiceStatus.PENDING ||
  //       invoice.status === InvoiceStatus.PARTIALLY_PAID
  //     ) {
  //       for (const item of invoice.items) {
  //         if (item.productId) {
  //           await this.productsService.updateStock(
  //             item.productId,
  //             item.quantity,
  //             'add',
  //           );
  //         }
  //       }
  //     }

  //     // Cancelar factura
  //     invoice.status = InvoiceStatus.CANCELLED;
  //     await manager.save(Invoice, invoice);

  //     return this.findOne(id);
  //   });
  // }

  async cancel(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('No se puede cancelar una factura pagada');
    }

    return this.dataSource.transaction(async (manager) => {
      // ✅ CRITICAL FIX: Restaurar inventario al cancelar factura
      // Solo restaurar si la factura estaba confirmada (PENDING o PARTIALLY_PAID)
      if (
        invoice.status === InvoiceStatus.PENDING ||
        invoice.status === InvoiceStatus.PARTIALLY_PAID
      ) {

        // Obtener almacén principal
        const mainWarehouseId = await this.getMainWarehouseId(invoice.organizationId);

        for (const item of invoice.items) {
          if (item.productId) {
            try {
              // Registrar devolución de venta (reversa de venta)
              await this.inventoryService.registerSaleReturn(
                item.productId,
                item.quantity,
                item.unitCost || 0, // Usar el costo original de la venta
                invoice.organizationId,
                invoice.createdById,
                'invoice_cancelled',
                invoice.id,
                {
                  invoiceNumber: invoice.number,
                  cancelledAt: new Date().toISOString(),
                  originalStatus: invoice.status,
                },
                mainWarehouseId,
              );
            } catch (error) {
              console.error(
                `❌ Error restaurando inventario para producto ${item.productId}:`,
                error,
              );
              // Continuar con otros items aunque falle uno
              // En un sistema profesional, podrías querer hacer rollback completo
              console.warn(
                `⚠️ Continuando cancelación a pesar del error en inventario`,
              );
            }
          }
        }

        // Restaurar balance del cliente si había pagos aplicados
        if (invoice.paidAmount > 0) {
          try {
            await this.customersService.updateBalance(
              invoice.customerId,
              invoice.paidAmount,
              'add', // Devolver el crédito al cliente
            );
          } catch (error) {
            console.error(`❌ Error restaurando balance del cliente:`, error);
          }
        }
      }

      // SINCRONIZACIÓN BIDIRECCIONAL: Cancelar crédito asociado si existe
      try {
        const associatedCredit = await manager.findOne(CustomerCredit, {
          where: { invoiceId: id },
        });

        if (associatedCredit && associatedCredit.status !== CreditStatus.CANCELLED) {
          // Restaurar el balance del cliente por el saldo pendiente del crédito
          if (associatedCredit.balanceDue > 0) {
            await this.customersService.updateBalance(
              invoice.customerId,
              associatedCredit.balanceDue,
              'subtract', // Reducir la deuda pendiente
            );
          }

          // Cancelar el crédito
          await manager.update(CustomerCredit, { id: associatedCredit.id }, {
            status: CreditStatus.CANCELLED,
          });

        }
      } catch (syncError) {
        console.error(`❌ [Invoice] Error al cancelar crédito asociado:`, syncError.message);
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
    partiallyPaid: number;
    totalSales: number;
    pendingAmount: number;
    overdueAmount: number;
  }> {
    // ✅ CRITICAL FIX: Filter by organizationId to prevent data leakage
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const total = await this.invoiceRepository.count({
      where: { organizationId: tenantId },
    });
    const draft = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.DRAFT, organizationId: tenantId },
    });
    const pending = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.PENDING, organizationId: tenantId },
    });
    const paid = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.PAID, organizationId: tenantId },
    });
    const cancelled = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.CANCELLED, organizationId: tenantId },
    });
    const partiallyPaid = await this.invoiceRepository.count({
      where: { status: InvoiceStatus.PARTIALLY_PAID, organizationId: tenantId },
    });

    // Facturas vencidas
    const overdue = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId', { organizationId: tenantId })
      .andWhere('invoice.dueDate < :today', { today: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
      })
      .getCount();

    // Montos
    const salesResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total)', 'totalSales')
      .addSelect('SUM(invoice.balanceDue)', 'pendingAmount')
      .where('invoice.organizationId = :organizationId', { organizationId: tenantId })
      .andWhere('invoice.status != :status', {
        status: InvoiceStatus.CANCELLED,
      })
      .getRawOne();

    const overdueResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.balanceDue)', 'overdueAmount')
      .where('invoice.organizationId = :organizationId', { organizationId: tenantId })
      .andWhere('invoice.dueDate < :today', { today: new Date() })
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
      partiallyPaid,
      totalSales: parseFloat(salesResult.totalSales) || 0,
      pendingAmount: parseFloat(salesResult.pendingAmount) || 0,
      overdueAmount: parseFloat(overdueResult.overdueAmount) || 0,
    };
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    // ✅ CRITICAL FIX: Filter by organizationId to prevent data leakage
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .where('invoice.organizationId = :organizationId', { organizationId: tenantId })
      .andWhere('invoice.dueDate < :today', { today: new Date() })
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

  /**
   * Obtener el almacén principal para descontar inventario
   */
  private async getMainWarehouseId(
    organizationId: string,
  ): Promise<string | null> {
    // 1. Buscar almacén marcado como principal
    const mainWarehouse = await this.warehouseRepository.findOne({
      where: {
        organizationId,
        isActive: true,
        isMainWarehouse: true,
      },
    });

    if (mainWarehouse) {
      return mainWarehouse.id;
    }

    // 2. Si no hay almacén principal, buscar el referenciado en la organización
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['mainWarehouseId'],
    });

    if (organization?.mainWarehouseId) {
      const orgMainWarehouse = await this.warehouseRepository.findOne({
        where: {
          id: organization.mainWarehouseId,
          organizationId,
          isActive: true,
        },
      });
      if (orgMainWarehouse) {
        return orgMainWarehouse.id;
      }
    }

    // 3. Si solo hay un almacén, usarlo
    const warehouses = await this.warehouseRepository.find({
      where: { organizationId, isActive: true },
    });

    if (warehouses.length === 1) {
      return warehouses[0].id;
    }

    // 4. Si no se puede determinar, retornar null (se manejará en la lógica superior)
    return null;
  }

  // ========== MÉTODOS DE VALIDACIÓN DE SUSCRIPCIÓN ==========

  /**
   * 🔒 VALIDACIÓN DE SUSCRIPCIÓN ACTIVA
   * No permite crear facturas si la suscripción está vencida, cancelada o suspendida
   */
  private async validateActiveSubscription(organizationId: string): Promise<void> {

    const canCreateInvoice = await this.subscriptionService.canPerformAction(
      organizationId,
      'create_invoice',
    );

    if (!canCreateInvoice) {
      // Obtener información de la suscripción para un mensaje más detallado
      const subscriptionInfo = await this.subscriptionService.getSubscriptionInfo(organizationId);

      let errorMessage = '❌ No es posible crear facturas. ';

      if (!subscriptionInfo || subscriptionInfo.isExpired) {
        errorMessage += 'Tu suscripción ha expirado. ';
        errorMessage += 'Por favor, renueva tu suscripción para continuar realizando ventas.';
      } else if (subscriptionInfo.status === 'suspended') {
        errorMessage += 'Tu suscripción está suspendida. ';
        errorMessage += 'Por favor, contacta a soporte para reactivar tu cuenta.';
      } else if (subscriptionInfo.status === 'cancelled') {
        errorMessage += 'Tu suscripción ha sido cancelada. ';
        errorMessage += 'Por favor, adquiere una nueva suscripción para continuar.';
      } else {
        errorMessage += 'Tu suscripción no está activa. ';
        errorMessage += 'Por favor, verifica el estado de tu cuenta.';
      }

      throw new BadRequestException(errorMessage);
    }

  }

  // ========== MÉTODOS DE VALIDACIÓN DE CRÉDITO PROFESIONALES ==========

  /**
   * 🔴 NUEVO: Validación profesional de límite de crédito
   * Basado en estándares de la industria 2024-2025
   */
  private async validateCreditAvailability(
    customer: any,
    invoiceDto: CreateInvoiceDto,
  ): Promise<void> {
    // 1. Validar que el cliente esté activo
    if (customer.status === 'suspended') {
      throw new BadRequestException(
        `❌ Cliente "${customer.displayName}" está SUSPENDIDO por mora. ` +
        `No se pueden crear facturas a crédito. ` +
        `Por favor, contacte al departamento de cartera.`,
      );
    }

    if (customer.status !== 'active') {
      throw new BadRequestException(
        `❌ Cliente "${customer.displayName}" no está activo (status: ${customer.status}). ` +
        `Solo se permiten ventas a crédito para clientes activos.`,
      );
    }

    // 2. Calcular total estimado de la factura
    const estimatedTotal = this.calculateEstimatedTotal(invoiceDto);


    // 3. Validar límite de crédito
    const creditLimit = Number(customer.creditLimit) || 0;
    const currentBalance = Number(customer.currentBalance) || 0;
    const availableCredit = Math.max(0, creditLimit - currentBalance);

    if (estimatedTotal > availableCredit) {
      const deficit = estimatedTotal - availableCredit;

      throw new BadRequestException(
        `❌ LÍMITE DE CRÉDITO EXCEDIDO\n\n` +
        `Cliente: ${customer.displayName}\n` +
        `Límite de crédito: $${creditLimit.toLocaleString()}\n` +
        `Saldo actual: $${currentBalance.toLocaleString()}\n` +
        `Crédito disponible: $${availableCredit.toLocaleString()}\n` +
        `Monto solicitado: $${estimatedTotal.toLocaleString()}\n` +
        `Déficit: $${deficit.toLocaleString()}\n\n` +
        `📞 Solicite aumento de cupo en el departamento de cartera o ` +
        `cambie el método de pago a efectivo/tarjeta.`,
      );
    }

    // 4. Validar facturas vencidas (política de riesgo)
    const overdueInvoices = await this.invoiceRepository.count({
      where: {
        customerId: customer.id,
        status: InvoiceStatus.OVERDUE,
      },
    });


    if (overdueInvoices >= 3) {
      throw new BadRequestException(
        `❌ CLIENTE CON MORA\n\n` +
        `El cliente "${customer.displayName}" tiene ${overdueInvoices} facturas vencidas.\n` +
        `Se requiere aprobación GERENCIAL para nuevas ventas a crédito.\n\n` +
        `Por favor:\n` +
        `1. Solicite al cliente ponerse al día con las facturas vencidas, o\n` +
        `2. Obtenga aprobación gerencial, o\n` +
        `3. Cambie el método de pago a efectivo/tarjeta.`,
      );
    }

    // 5. Advertencia si está cerca del límite (80% o más)
    const newBalance = currentBalance + estimatedTotal;
    const usagePercent = creditLimit > 0 ? (newBalance / creditLimit) * 100 : 0;

    if (usagePercent >= 80 && usagePercent < 100) {
      console.warn(
        `⚠️  ADVERTENCIA: Cliente "${customer.displayName}" usando ${usagePercent.toFixed(1)}% de su límite de crédito`,
      );

      // 🔔 NUEVO: Notificar cliente cerca del límite
      try {
        await this.notificationsService.create({
          organizationId: customer.organizationId,
          userId: customer.createdById || customer.organizationId,
          type: NotificationType.CUSTOMER_NEAR_CREDIT_LIMIT,
          severity: NotificationSeverity.WARNING,
          title: `⚠️ Cliente cerca del límite de crédito`,
          message: `${customer.displayName} está usando ${usagePercent.toFixed(1)}% de su límite ($${newBalance.toLocaleString('es-CO')} de $${creditLimit.toLocaleString('es-CO')})`,
          metadata: {
            customerId: customer.id,
            customerName: customer.displayName,
            amount: newBalance,
            usagePercent: parseFloat(usagePercent.toFixed(1)),
            actionUrl: `/customers/${customer.id}`,
            actionLabel: 'Ver Cliente',
          },
        });
      } catch (notifError) {
        console.warn(
          `⚠️ Error creando notificación de crédito: ${notifError.message}`,
        );
      }
    }

    if (overdueInvoices >= 1 && overdueInvoices < 3) {
      console.warn(
        `⚠️  ADVERTENCIA: Cliente "${customer.displayName}" tiene ${overdueInvoices} factura(s) vencida(s)`,
      );
      // Continuar pero alertar
    }
  }

  /**
   * Calcular total estimado de la factura ANTES de crearla
   * Útil para validaciones de límite de crédito
   */
  private calculateEstimatedTotal(invoiceDto: CreateInvoiceDto): number {
    let subtotal = 0;

    // ✅ USAR EL IVA DE LA FACTURA (no hardcodeado)
    const taxPercent = Number(invoiceDto.taxPercentage) || 19;
    const taxDivisor = 1 + (taxPercent / 100); // Ej: 5% = 1.05, 19% = 1.19

    // Sumar subtotales de items
    for (const item of invoiceDto.items) {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;

      // Calcular precio sin IVA usando el IVA correcto de la factura
      const priceWithoutTax = unitPrice / taxDivisor;
      const itemSubtotal = quantity * priceWithoutTax;

      // Aplicar descuento de item si existe
      const itemDiscountPercent = Number(item.discountPercentage) || 0;
      const itemTotal = itemSubtotal * (1 - itemDiscountPercent / 100);

      subtotal += itemTotal;
    }

    // Aplicar descuento general de factura
    const discountPercent = Number(invoiceDto.discountPercentage) || 0;
    const discountAmount = Number(invoiceDto.discountAmount) || 0;

    if (discountPercent > 0) {
      subtotal = subtotal * (1 - discountPercent / 100);
    } else if (discountAmount > 0) {
      subtotal = subtotal - discountAmount;
    }

    // Aplicar IVA
    const total = subtotal * (1 + taxPercent / 100);

    return Math.round(total * 100) / 100;
  }

  // ========== FIN MÉTODOS DE VALIDACIÓN DE CRÉDITO ==========

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

  /**
   * Genera descripción y notas detalladas para un crédito originado de una factura parcial
   * Proporciona información completa del origen del crédito para mejor experiencia de usuario
   */
  private generateCreditDetailsFromInvoice(
    invoice: Invoice,
    payments: Array<{ amount: number; method: string; bankAccountName?: string | null }>,
    totalPaid: number,
    remainingBalance: number,
    additionalNotes?: string,
  ): { description: string; notes: string } {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    // Mapeo de métodos de pago a nombres legibles en español
    const paymentMethodNames: Record<string, string> = {
      'cash': 'Efectivo',
      'efectivo': 'Efectivo',
      'bank_transfer': 'Transferencia Bancaria',
      'transferencia': 'Transferencia Bancaria',
      'credit_card': 'Tarjeta de Crédito',
      'debit_card': 'Tarjeta de Débito',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'check': 'Cheque',
      'cheque': 'Cheque',
      'credit': 'Crédito',
      'other': 'Otro',
      'CASH': 'Efectivo',
      'BANK_TRANSFER': 'Transferencia Bancaria',
      'CREDIT_CARD': 'Tarjeta de Crédito',
      'DEBIT_CARD': 'Tarjeta de Débito',
      'CHECK': 'Cheque',
      'CREDIT': 'Crédito',
      'OTHER': 'Otro',
    };

    // Descripción concisa para mostrar en listas
    const description = `Saldo pendiente de Factura ${invoice.number}`;

    // Construir notas detalladas
    const notesLines: string[] = [];

    // Encabezado
    notesLines.push('═══════════════════════════════════════');
    notesLines.push('       DETALLE DEL CRÉDITO');
    notesLines.push('═══════════════════════════════════════');
    notesLines.push('');

    // Información de la factura origen
    notesLines.push('📄 FACTURA ORIGEN');
    notesLines.push(`   • Número: ${invoice.number}`);
    notesLines.push(`   • Fecha: ${formatDate(invoice.date instanceof Date ? invoice.date : new Date(invoice.date))}`);
    notesLines.push(`   • Total: ${formatCurrency(invoice.total)}`);
    notesLines.push('');

    // Desglose de pagos realizados
    notesLines.push('💰 PAGOS REALIZADOS');
    if (payments && payments.length > 0) {
      payments.forEach((payment, index) => {
        if (payment.amount > 0) {
          const methodName = paymentMethodNames[payment.method] || payment.method;
          let paymentLine = `   ${index + 1}. ${formatCurrency(payment.amount)} - ${methodName}`;
          if (payment.bankAccountName) {
            paymentLine += ` (${payment.bankAccountName})`;
          }
          notesLines.push(paymentLine);
        }
      });
      notesLines.push(`   ─────────────────────────`);
      notesLines.push(`   Total pagado: ${formatCurrency(totalPaid)}`);
    } else {
      notesLines.push('   Sin pagos registrados');
    }
    notesLines.push('');

    // Saldo pendiente (crédito generado)
    notesLines.push('📊 SALDO PENDIENTE');
    notesLines.push(`   • Monto del crédito: ${formatCurrency(remainingBalance)}`);
    notesLines.push(`   • Porcentaje pendiente: ${((remainingBalance / invoice.total) * 100).toFixed(1)}%`);
    notesLines.push('');

    // Fecha de generación
    notesLines.push('📅 INFORMACIÓN ADICIONAL');
    notesLines.push(`   • Generado: ${formatDate(new Date())}`);
    notesLines.push(`   • Tipo: Crédito por pago parcial`);

    // Notas adicionales del usuario
    if (additionalNotes && additionalNotes.trim()) {
      notesLines.push('');
      notesLines.push('📝 NOTAS');
      notesLines.push(`   ${additionalNotes}`);
    }

    notesLines.push('');
    notesLines.push('═══════════════════════════════════════');

    return {
      description,
      notes: notesLines.join('\n'),
    };
  }
}
