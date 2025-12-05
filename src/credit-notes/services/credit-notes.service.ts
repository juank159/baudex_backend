// src/credit-notes/services/credit-notes.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, Between } from 'typeorm';
import { CreditNote, CreditNoteStatus, CreditNoteType } from '../entities/credit-note.entity';
import { CreditNoteItem } from '../entities/credit-note-item.entity';
import { Invoice, InvoiceStatus } from '../../invoices/entities/invoice.entity';
import { CreateCreditNoteDto } from '../dto/create-credit-note.dto';
import { UpdateCreditNoteDto } from '../dto/update-credit-note.dto';
import { QueryCreditNotesDto } from '../dto/query-credit-notes.dto';
import { TenantAwareService } from '../../common/services/tenant-aware.service';
import { CustomersService } from '../../customers/customers.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { WarehousesService } from '../../warehouses/warehouses.service';

/**
 * Servicio de Notas de Crédito
 *
 * Maneja toda la lógica de negocio relacionada con notas de crédito:
 * - Creación y validación
 * - Aplicación de créditos al balance del cliente
 * - Restauración de inventario
 * - Consultas y filtros
 */
@Injectable()
export class CreditNotesService {
  constructor(
    @InjectRepository(CreditNote)
    private readonly creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(CreditNoteItem)
    private readonly creditNoteItemRepository: Repository<CreditNoteItem>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly dataSource: DataSource,
    private readonly tenantAwareService: TenantAwareService,
    private readonly customersService: CustomersService,
    private readonly inventoryService: InventoryService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /**
   * Crear una nota de crédito
   *
   * Proceso:
   * 1. Validar que la factura existe y pertenece a la organización
   * 2. Validar estado de la factura
   * 3. Validar que no se exceda el monto acreditable
   * 4. Generar número de nota de crédito
   * 5. Calcular montos
   * 6. Crear nota de crédito y sus items
   */
  async create(
    createCreditNoteDto: CreateCreditNoteDto,
    userId: string,
  ): Promise<CreditNote> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // La transacción retorna el ID de la nota de crédito creada
    const creditNoteId = await this.dataSource.transaction(async (manager) => {
      // 1. Obtener y validar factura
      const invoice = await manager.findOne(Invoice, {
        where: { id: createCreditNoteDto.invoiceId, organizationId: tenantId },
        relations: ['items', 'customer'],
      });

      if (!invoice) {
        throw new NotFoundException(
          `Factura con ID ${createCreditNoteDto.invoiceId} no encontrada`,
        );
      }

      // 2. Validar que la factura puede recibir notas de crédito
      this.validateInvoiceForCreditNote(invoice);

      // 3. Validar que no existan notas de crédito en DRAFT que conflicten
      await this.validateNoDraftConflicts(
        createCreditNoteDto,
        invoice.id,
        manager,
      );

      // 4. Calcular monto acreditable restante
      const remainingCreditableAmount = await this.getRemainingCreditableAmount(
        invoice.id,
      );

      // 5. Validar items y calcular totales
      const { items, subtotal, taxAmount, total } = await this.validateAndCalculateItems(
        createCreditNoteDto,
        invoice,
        manager,
      );

      // 6. Validar que no se exceda el monto acreditable
      if (total > remainingCreditableAmount) {
        throw new BadRequestException(
          `El monto total de la nota de crédito ($${total.toFixed(2)}) excede el monto acreditable restante ($${remainingCreditableAmount.toFixed(2)})`,
        );
      }

      // 7. Generar número de nota de crédito
      const number = await this.generateCreditNoteNumber(tenantId, manager);

      // 8. Crear nota de crédito
      const creditNote = manager.create(CreditNote, {
        number,
        date: new Date(),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        organizationId: tenantId,
        createdById: userId,
        type: createCreditNoteDto.type,
        reason: createCreditNoteDto.reason,
        reasonDescription: createCreditNoteDto.reasonDescription,
        subtotal,
        taxPercentage: invoice.taxPercentage,
        taxAmount,
        total,
        status: CreditNoteStatus.DRAFT,
        restoreInventory: createCreditNoteDto.restoreInventory ?? true,
        notes: createCreditNoteDto.notes,
        terms: createCreditNoteDto.terms,
      });

      await manager.save(CreditNote, creditNote);

      // 9. Crear items de nota de crédito
      for (const itemDto of items) {
        const item = manager.create(CreditNoteItem, {
          creditNoteId: creditNote.id,
          ...itemDto,
        });
        await manager.save(CreditNoteItem, item);
      }

      console.log(
        `✅ Nota de crédito ${number} creada para factura ${invoice.number}`,
      );

      // Retornar el ID para buscar después de la transacción
      return creditNote.id;
    });

    // Buscar la nota de crédito con relaciones DESPUÉS de que la transacción termine
    return this.findOne(creditNoteId);
  }

  /**
   * Confirmar una nota de crédito
   *
   * Proceso:
   * 1. Validar que está en estado DRAFT
   * 2. Aplicar crédito al balance del cliente
   * 3. Restaurar inventario (si aplica)
   * 4. Cambiar estado a CONFIRMED
   */
  async confirm(id: string, userId: string): Promise<CreditNote> {
    const creditNote = await this.findOne(id);

    if (creditNote.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Solo se pueden confirmar notas de crédito en estado DRAFT. Estado actual: ${creditNote.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Aplicar crédito al balance del cliente (reducir deuda)
      await this.customersService.updateBalance(
        creditNote.customerId,
        creditNote.total,
        'subtract', // Restar del balance (reducir lo que debe)
      );

      // 2. Restaurar inventario si está configurado Y no se ha restaurado previamente
      if (creditNote.restoreInventory && !creditNote.inventoryRestored) {
        await this.restoreInventory(creditNote, userId, manager);
      }

      // 3. Actualizar estado de nota de crédito
      creditNote.status = CreditNoteStatus.CONFIRMED;
      creditNote.appliedAt = new Date();
      creditNote.appliedById = userId;

      const savedCreditNote = await manager.save(CreditNote, creditNote);

      // 4. Actualizar estado de la factura asociada
      await this.updateInvoiceStatusAfterCreditNote(creditNote, manager);

      console.log(
        `✅ Nota de crédito ${creditNote.number} confirmada - Crédito aplicado: $${Number(creditNote.total).toFixed(2)}`,
      );

      // Cargar las relaciones necesarias para la respuesta
      const result = await manager.findOne(CreditNote, {
        where: { id: savedCreditNote.id },
        relations: ['customer', 'invoice', 'items', 'items.product', 'createdBy', 'appliedBy'],
      });

      return result!;
    });
  }

  /**
   * Actualizar el estado de la factura después de aplicar una nota de crédito
   *
   * Lógica:
   * - Si el total acreditado >= total factura → CREDITED (totalmente acreditada)
   * - Si el total acreditado < total factura → PARTIALLY_CREDITED (parcialmente acreditada)
   */
  private async updateInvoiceStatusAfterCreditNote(
    creditNote: CreditNote,
    manager: any,
  ): Promise<void> {
    const invoice = await manager.findOne(Invoice, {
      where: { id: creditNote.invoiceId },
    });

    if (!invoice) {
      console.warn(`⚠️ Factura ${creditNote.invoiceId} no encontrada para actualizar estado`);
      return;
    }

    const creditNoteTotal = Number(creditNote.total) || 0;
    const invoiceTotal = Number(invoice.total) || 0;
    const currentCreditedAmount = Number(invoice.creditedAmount) || 0;

    // Calcular nuevo monto acreditado total
    const newCreditedAmount = currentCreditedAmount + creditNoteTotal;

    // Actualizar el monto acreditado
    invoice.creditedAmount = newCreditedAmount;

    // Determinar nuevo estado de la factura
    const tolerance = 0.01; // Tolerancia para comparaciones de punto flotante

    if (newCreditedAmount >= invoiceTotal - tolerance) {
      // Nota de crédito cubre el total de la factura
      invoice.status = InvoiceStatus.CREDITED;
      invoice.balanceDue = 0;
      console.log(
        `📋 Factura ${invoice.number} marcada como CREDITED (totalmente acreditada) - NC: $${creditNoteTotal.toFixed(2)}`,
      );
    } else {
      // Nota de crédito parcial
      invoice.status = InvoiceStatus.PARTIALLY_CREDITED;
      // Actualizar balance pendiente restando el crédito aplicado
      const paidAmount = Number(invoice.paidAmount) || 0;
      invoice.balanceDue = Math.max(0, invoiceTotal - paidAmount - newCreditedAmount);
      console.log(
        `📋 Factura ${invoice.number} marcada como PARTIALLY_CREDITED - NC: $${creditNoteTotal.toFixed(2)}, Balance: $${invoice.balanceDue.toFixed(2)}`,
      );
    }

    await manager.save(Invoice, invoice);
  }

  /**
   * Cancelar una nota de crédito (solo en DRAFT)
   */
  async cancel(id: string): Promise<CreditNote> {
    const creditNote = await this.findOne(id);

    if (creditNote.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Solo se pueden cancelar notas de crédito en estado DRAFT`,
      );
    }

    creditNote.status = CreditNoteStatus.CANCELLED;
    const savedCreditNote = await this.creditNoteRepository.save(creditNote);

    console.log(`❌ Nota de crédito ${creditNote.number} cancelada`);

    // Retornar la entidad con las relaciones cargadas
    return this.creditNoteRepository.findOne({
      where: { id: savedCreditNote.id },
      relations: ['customer', 'invoice', 'items', 'items.product', 'createdBy', 'appliedBy'],
    }) as Promise<CreditNote>;
  }

  /**
   * Actualizar una nota de crédito (solo en DRAFT)
   */
  async update(
    id: string,
    updateCreditNoteDto: UpdateCreditNoteDto,
  ): Promise<CreditNote> {
    const creditNote = await this.findOne(id);

    if (creditNote.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Solo se pueden actualizar notas de crédito en estado DRAFT`,
      );
    }

    Object.assign(creditNote, updateCreditNoteDto);
    await this.creditNoteRepository.save(creditNote);

    console.log(`📝 Nota de crédito ${creditNote.number} actualizada`);

    return this.findOne(id);
  }

  /**
   * Eliminar una nota de crédito (solo en DRAFT)
   */
  async remove(id: string): Promise<void> {
    const creditNote = await this.findOne(id);

    if (creditNote.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Solo se pueden eliminar notas de crédito en estado DRAFT`,
      );
    }

    await this.creditNoteRepository.softDelete(id);

    console.log(`🗑️ Nota de crédito ${creditNote.number} eliminada`);
  }

  /**
   * Obtener nota de crédito por ID
   */
  async findOne(id: string): Promise<CreditNote> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const creditNote = await this.creditNoteRepository.findOne({
      where: { id, organizationId: tenantId },
      relations: [
        'items',
        'items.product',
        'items.invoiceItem',
        'invoice',
        'customer',
        'createdBy',
        'appliedBy',
      ],
    });

    if (!creditNote) {
      throw new NotFoundException(`Nota de crédito con ID ${id} no encontrada`);
    }

    return creditNote;
  }

  /**
   * Obtener notas de crédito con filtros y paginación
   */
  async findAll(queryDto: QueryCreditNotesDto) {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    const {
      page = 1,
      limit = 10,
      search,
      invoiceId,
      customerId,
      status,
      type,
      reason,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'DESC',
    } = queryDto;

    const skip = (page - 1) * limit;

    const queryBuilder = this.creditNoteRepository
      .createQueryBuilder('cn')
      .leftJoinAndSelect('cn.items', 'items')
      .leftJoinAndSelect('cn.invoice', 'invoice')
      .leftJoinAndSelect('cn.customer', 'customer')
      .leftJoinAndSelect('cn.createdBy', 'createdBy')
      .where('cn.organizationId = :tenantId', { tenantId });

    // Filtros
    if (search) {
      queryBuilder.andWhere(
        '(cn.number ILIKE :search OR invoice.number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (invoiceId) {
      queryBuilder.andWhere('cn.invoiceId = :invoiceId', { invoiceId });
    }

    if (customerId) {
      queryBuilder.andWhere('cn.customerId = :customerId', { customerId });
    }

    if (status) {
      queryBuilder.andWhere('cn.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('cn.type = :type', { type });
    }

    if (reason) {
      queryBuilder.andWhere('cn.reason = :reason', { reason });
    }

    if (startDate) {
      queryBuilder.andWhere('cn.date >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('cn.date <= :endDate', { endDate });
    }

    // Ordenar
    queryBuilder.orderBy(`cn.${sortBy}`, sortOrder);

    // Paginación
    const [creditNotes, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: creditNotes,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener notas de crédito por factura
   */
  async findByInvoice(invoiceId: string): Promise<CreditNote[]> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    return this.creditNoteRepository.find({
      where: { invoiceId, organizationId: tenantId },
      relations: ['items', 'customer', 'createdBy'],
      order: { date: 'DESC' },
    });
  }

  /**
   * Obtener monto acreditable restante de una factura
   */
  async getRemainingCreditableAmount(invoiceId: string): Promise<number> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // Obtener factura
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, organizationId: tenantId },
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
    }

    // Calcular total acreditado (solo CONFIRMED)
    const result = await this.creditNoteRepository
      .createQueryBuilder('cn')
      .select('COALESCE(SUM(cn.total), 0)', 'totalCredited')
      .where('cn.invoiceId = :invoiceId', { invoiceId })
      .andWhere('cn.status = :status', { status: CreditNoteStatus.CONFIRMED })
      .getRawOne();

    const totalCredited = parseFloat(result.totalCredited || '0');
    const invoiceTotal = Number(invoice.total) || 0;
    const remaining = invoiceTotal - totalCredited;

    return Math.max(remaining, 0); // No puede ser negativo
  }

  /**
   * Obtener cantidades disponibles por item de factura para notas de crédito
   *
   * Considera:
   * - Cantidades originales de la factura
   * - Cantidades ya acreditadas (CONFIRMED)
   * - Cantidades en borradores (DRAFT) - reservadas pero no confirmadas
   *
   * Retorna información detallada para que el frontend pueda:
   * - Mostrar solo items con cantidades disponibles
   * - Mostrar las cantidades máximas que se pueden acreditar
   * - Informar al usuario sobre borradores existentes
   */
  async getAvailableQuantitiesForCreditNote(invoiceId: string): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceTotal: number;
    remainingCreditableAmount: number;
    totalCreditedAmount: number;
    totalDraftAmount: number;
    items: Array<{
      invoiceItemId: string;
      productId: string | null;
      description: string;
      unit: string;
      unitPrice: number;
      originalQuantity: number;
      creditedQuantity: number;
      draftQuantity: number;
      availableQuantity: number;
      isFullyCredited: boolean;
      hasDraft: boolean;
      draftCreditNoteNumbers: string[];
    }>;
    draftCreditNotes: Array<{
      id: string;
      number: string;
      total: number;
      type: string;
      createdAt: Date;
    }>;
    canCreateFullCreditNote: boolean;
    canCreatePartialCreditNote: boolean;
    message: string | null;
  }> {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización');
    }

    // 1. Obtener factura con items
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, organizationId: tenantId },
      relations: ['items', 'items.product'],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
    }

    // 2. Obtener todas las notas de crédito (CONFIRMED y DRAFT) para esta factura
    const creditNotes = await this.creditNoteRepository.find({
      where: {
        invoiceId,
        organizationId: tenantId,
      },
      relations: ['items'],
    });

    // Filtrar por estado (excluir canceladas)
    const activeCreditNotes = creditNotes.filter(
      cn => cn.status === CreditNoteStatus.CONFIRMED || cn.status === CreditNoteStatus.DRAFT
    );

    const confirmedCreditNotes = activeCreditNotes.filter(cn => cn.status === CreditNoteStatus.CONFIRMED);
    const draftCreditNotes = activeCreditNotes.filter(cn => cn.status === CreditNoteStatus.DRAFT);

    // 3. Calcular cantidades por item
    const itemQuantities = new Map<string, {
      creditedQuantity: number;
      draftQuantity: number;
      draftCreditNoteNumbers: string[];
    }>();

    // Inicializar con 0
    for (const item of invoice.items) {
      itemQuantities.set(item.id, {
        creditedQuantity: 0,
        draftQuantity: 0,
        draftCreditNoteNumbers: [],
      });
    }

    // Sumar cantidades de notas confirmadas
    for (const cn of confirmedCreditNotes) {
      for (const cnItem of cn.items) {
        if (cnItem.invoiceItemId) {
          const existing = itemQuantities.get(cnItem.invoiceItemId);
          if (existing) {
            existing.creditedQuantity += Number(cnItem.quantity) || 0;
          }
        }
      }
    }

    // Sumar cantidades de borradores
    for (const cn of draftCreditNotes) {
      for (const cnItem of cn.items) {
        if (cnItem.invoiceItemId) {
          const existing = itemQuantities.get(cnItem.invoiceItemId);
          if (existing) {
            existing.draftQuantity += Number(cnItem.quantity) || 0;
            if (!existing.draftCreditNoteNumbers.includes(cn.number)) {
              existing.draftCreditNoteNumbers.push(cn.number);
            }
          }
        }
      }
    }

    // 4. Construir respuesta de items
    const items = invoice.items.map(item => {
      const quantities = itemQuantities.get(item.id) || {
        creditedQuantity: 0,
        draftQuantity: 0,
        draftCreditNoteNumbers: [],
      };

      const originalQuantity = Number(item.quantity) || 0;
      const creditedQuantity = quantities.creditedQuantity;
      const draftQuantity = quantities.draftQuantity;
      const availableQuantity = Math.max(0, originalQuantity - creditedQuantity - draftQuantity);

      return {
        invoiceItemId: item.id,
        productId: item.productId,
        description: item.description,
        unit: item.unit || 'UND',
        unitPrice: Number(item.unitPrice) || 0,
        originalQuantity,
        creditedQuantity,
        draftQuantity,
        availableQuantity,
        isFullyCredited: availableQuantity <= 0 && creditedQuantity >= originalQuantity,
        hasDraft: draftQuantity > 0,
        draftCreditNoteNumbers: quantities.draftCreditNoteNumbers,
      };
    });

    // 5. Calcular totales
    const invoiceTotal = Number(invoice.total) || 0;
    const totalCreditedAmount = confirmedCreditNotes.reduce(
      (sum, cn) => sum + (Number(cn.total) || 0),
      0
    );
    const totalDraftAmount = draftCreditNotes.reduce(
      (sum, cn) => sum + (Number(cn.total) || 0),
      0
    );
    const remainingCreditableAmount = Math.max(0, invoiceTotal - totalCreditedAmount);

    // 6. Determinar si se pueden crear notas de crédito
    const hasFullDraft = draftCreditNotes.some(cn => cn.type === CreditNoteType.FULL);
    const hasAnyDraft = draftCreditNotes.length > 0;
    const hasAvailableItems = items.some(item => item.availableQuantity > 0);
    const isFullyCredited = remainingCreditableAmount <= 0;

    let canCreateFullCreditNote = !isFullyCredited && !hasAnyDraft;
    let canCreatePartialCreditNote = !isFullyCredited && !hasFullDraft && hasAvailableItems;

    // 7. Generar mensaje informativo
    let message: string | null = null;
    if (isFullyCredited) {
      message = 'Esta factura ya ha sido completamente acreditada.';
    } else if (hasFullDraft) {
      message = `Existe una nota de crédito completa en borrador (${draftCreditNotes.find(cn => cn.type === CreditNoteType.FULL)?.number}). Debe confirmarla, cancelarla o eliminarla antes de crear otra.`;
    } else if (hasAnyDraft && !hasAvailableItems) {
      message = 'Todos los items tienen notas de crédito en borrador. Confirme o cancele los borradores existentes.';
    }

    return {
      invoiceId,
      invoiceNumber: invoice.number,
      invoiceTotal,
      remainingCreditableAmount,
      totalCreditedAmount,
      totalDraftAmount,
      items,
      draftCreditNotes: draftCreditNotes.map(cn => ({
        id: cn.id,
        number: cn.number,
        total: Number(cn.total) || 0,
        type: cn.type,
        createdAt: cn.createdAt,
      })),
      canCreateFullCreditNote,
      canCreatePartialCreditNote,
      message,
    };
  }

  /**
   * Generar número de nota de crédito
   */
  private async generateCreditNoteNumber(
    organizationId: string,
    manager: any,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CN-${year}`;

    // Obtener último número del año (incluye eliminadas para evitar duplicados)
    const lastCreditNote = await manager
      .createQueryBuilder(CreditNote, 'cn')
      .withDeleted()
      .where('cn.organizationId = :organizationId', { organizationId })
      .andWhere('cn.number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('cn.number', 'DESC')
      .getOne();

    let nextNumber = 1;

    if (lastCreditNote) {
      const lastNumberStr = lastCreditNote.number.split('-').pop();
      const lastNumber = parseInt(lastNumberStr, 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Validar que no existan notas de crédito en DRAFT que conflicten
   *
   * Reglas:
   * 1. Si existe una nota de crédito COMPLETA en DRAFT para la factura, no permitir crear más
   * 2. Si se intenta crear una nota COMPLETA y ya existen notas PARCIALES en DRAFT, no permitir
   * 3. Para notas PARCIALES, validar que no existan notas en DRAFT para los mismos productos
   */
  private async validateNoDraftConflicts(
    createCreditNoteDto: CreateCreditNoteDto,
    invoiceId: string,
    manager: any,
  ): Promise<void> {
    // Buscar todas las notas de crédito en DRAFT para esta factura
    const draftCreditNotes = await manager.find(CreditNote, {
      where: {
        invoiceId,
        status: CreditNoteStatus.DRAFT,
      },
      relations: ['items'],
    });

    if (draftCreditNotes.length === 0) {
      return; // No hay conflictos posibles
    }

    // Regla 1: Si existe una nota COMPLETA en DRAFT, no permitir crear más
    const existingFullDraft = draftCreditNotes.find(
      (cn) => cn.type === CreditNoteType.FULL,
    );

    if (existingFullDraft) {
      throw new BadRequestException(
        `Ya existe una nota de crédito completa en borrador (${existingFullDraft.number}) para esta factura. ` +
        `Debe confirmarla, cancelarla o eliminarla antes de crear una nueva.`,
      );
    }

    // Regla 2: Si se intenta crear una nota COMPLETA y ya existen PARCIALES en DRAFT
    if (createCreditNoteDto.type === CreditNoteType.FULL) {
      const partialDrafts = draftCreditNotes.filter(
        (cn) => cn.type === CreditNoteType.PARTIAL,
      );

      if (partialDrafts.length > 0) {
        const draftNumbers = partialDrafts.map((cn) => cn.number).join(', ');
        throw new BadRequestException(
          `No se puede crear una nota de crédito completa porque existen notas parciales en borrador (${draftNumbers}). ` +
          `Debe confirmarlas, cancelarlas o eliminarlas antes de crear una nota completa.`,
        );
      }
    }

    // Regla 3: Para notas PARCIALES, validar que no existan notas en DRAFT para los mismos items de factura
    if (createCreditNoteDto.type === CreditNoteType.PARTIAL && createCreditNoteDto.items) {
      // Mapas para rastrear items en DRAFT por invoiceItemId y productId
      const draftInvoiceItemIds = new Set<string>();
      const draftProductIds = new Set<string>();
      const invoiceItemToDraftMap = new Map<string, { number: string; quantity: number }>(); // invoiceItemId -> {creditNoteNumber, quantity}
      const productToDraftMap = new Map<string, string>(); // productId -> creditNoteNumber

      for (const draftNote of draftCreditNotes) {
        for (const item of draftNote.items) {
          // Rastrear por invoiceItemId (más preciso)
          if (item.invoiceItemId) {
            draftInvoiceItemIds.add(item.invoiceItemId);
            const existing = invoiceItemToDraftMap.get(item.invoiceItemId);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              invoiceItemToDraftMap.set(item.invoiceItemId, {
                number: draftNote.number,
                quantity: item.quantity,
              });
            }
          }
          // También rastrear por productId como fallback
          if (item.productId) {
            draftProductIds.add(item.productId);
            productToDraftMap.set(item.productId, draftNote.number);
          }
        }
      }

      // Verificar si algún item de la nueva nota ya está en un DRAFT
      const conflictingItems: string[] = [];

      for (const newItem of createCreditNoteDto.items) {
        // Primero verificar por invoiceItemId (más preciso)
        if (newItem.invoiceItemId && draftInvoiceItemIds.has(newItem.invoiceItemId)) {
          const existingDraft = invoiceItemToDraftMap.get(newItem.invoiceItemId);
          conflictingItems.push(
            `"${newItem.description}" (ya tiene ${existingDraft.quantity} unidades en borrador ${existingDraft.number})`,
          );
        }
        // Si no tiene invoiceItemId, verificar por productId
        else if (newItem.productId && draftProductIds.has(newItem.productId)) {
          const existingDraftNumber = productToDraftMap.get(newItem.productId);
          conflictingItems.push(
            `"${newItem.description}" (ya en borrador ${existingDraftNumber})`,
          );
        }
      }

      if (conflictingItems.length > 0) {
        throw new BadRequestException(
          `Los siguientes items ya tienen notas de crédito en borrador: ${conflictingItems.join(', ')}. ` +
          `Debe confirmar, cancelar o eliminar esas notas antes de crear una nueva para estos items.`,
        );
      }
    }
  }

  /**
   * Validar que la factura puede recibir notas de crédito
   */
  private validateInvoiceForCreditNote(invoice: Invoice): void {
    const allowedStatuses = [
      InvoiceStatus.PAID,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PENDING,
      InvoiceStatus.PARTIALLY_CREDITED, // Permitir crear más notas de crédito mientras no excedan el total
    ];

    if (!allowedStatuses.includes(invoice.status)) {
      throw new BadRequestException(
        `No se pueden crear notas de crédito para facturas con estado ${invoice.status}. Estados permitidos: ${allowedStatuses.join(', ')}`,
      );
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'No se pueden crear notas de crédito para facturas canceladas',
      );
    }
  }

  /**
   * Validar items y calcular totales
   */
  private async validateAndCalculateItems(
    createCreditNoteDto: CreateCreditNoteDto,
    invoice: Invoice,
    manager: any,
  ) {
    const { type, items: itemsDto } = createCreditNoteDto;

    // Para tipo FULL, usar todos los items de la factura
    if (type === CreditNoteType.FULL) {
      const items = invoice.items.map((invoiceItem) => ({
        invoiceItemId: invoiceItem.id,
        productId: invoiceItem.productId,
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        unitPrice: invoiceItem.unitPrice,
        subtotal: invoiceItem.subtotal,
        unit: invoiceItem.unit,
        unitCost: invoiceItem.unitCost,
        discountPercentage: invoiceItem.discountPercentage,
        discountAmount: invoiceItem.discountAmount,
      }));

      return {
        items,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
      };
    }

    // Para tipo PARTIAL, validar items proporcionados
    if (!itemsDto || itemsDto.length === 0) {
      throw new BadRequestException(
        'Para notas de crédito PARCIALES, debe proporcionar los items',
      );
    }

    // Calcular totales
    // IMPORTANTE: El unitPrice que viene del frontend YA INCLUYE IVA (es el precio de venta final)
    // NO se debe sumar IVA adicional - el total es directamente el precio con IVA incluido
    const taxRate = invoice.taxPercentage / 100;
    let total = 0;

    const items = itemsDto.map((itemDto) => {
      // El total del item es simplemente quantity * unitPrice - descuento
      // El unitPrice YA INCLUYE IVA, así que NO sumamos IVA adicional
      const itemTotal = itemDto.quantity * itemDto.unitPrice - (itemDto.discountAmount || 0);
      total += itemTotal;

      // Para el desglose, calculamos el subtotal sin IVA (solo informativo)
      const itemSubtotal = itemTotal / (1 + taxRate);

      return {
        ...itemDto,
        subtotal: Number(itemSubtotal.toFixed(2)),
        totalCost: itemDto.unitCost ? itemDto.quantity * itemDto.unitCost : 0,
      };
    });

    // Calcular el desglose del total (solo para mostrar)
    // subtotal = total / (1 + taxRate) -> el valor sin IVA
    // taxAmount = total - subtotal -> el IVA incluido
    const subtotal = total / (1 + taxRate);
    const taxAmount = total - subtotal;

    console.log(`📊 Cálculo nota de crédito parcial:
      - Total con IVA incluido: $${total.toFixed(2)}
      - Subtotal (sin IVA): $${subtotal.toFixed(2)}
      - IVA incluido: $${taxAmount.toFixed(2)}
      - Tasa IVA: ${invoice.taxPercentage}%`);

    return {
      items,
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }

  /**
   * Restaurar inventario
   */
  private async restoreInventory(
    creditNote: CreditNote,
    userId: string,
    manager: any,
  ): Promise<void> {
    console.log(
      `📦 Restaurando inventario para nota de crédito ${creditNote.number}`,
    );

    // Obtener almacén principal
    const mainWarehouseId = await this.getMainWarehouseId(
      creditNote.organizationId,
    );

    for (const item of creditNote.items) {
      if (item.productId) {
        try {
          await this.inventoryService.registerSaleReturn(
            item.productId,
            item.quantity,
            item.unitCost || 0,
            creditNote.organizationId,
            userId,
            'credit_note',
            creditNote.id,
            {
              creditNoteNumber: creditNote.number,
              invoiceId: creditNote.invoiceId,
              reason: creditNote.reason,
              description: item.description,
            },
            mainWarehouseId,
          );

          console.log(
            `✅ Inventario restaurado: ${item.quantity} ${item.unit || 'unidades'} de ${item.description}`,
          );
        } catch (error) {
          console.error(
            `❌ Error restaurando inventario para item ${item.id}:`,
            error,
          );
          throw new BadRequestException(
            `Error restaurando inventario: ${error.message}`,
          );
        }
      }
    }

    // Marcar inventario como restaurado
    creditNote.inventoryRestored = true;
    creditNote.inventoryRestoredAt = new Date();
    await manager.save(CreditNote, creditNote);
  }

  /**
   * Obtener ID del almacén principal
   * Delega al WarehousesService para obtener el almacén principal
   */
  private async getMainWarehouseId(organizationId: string): Promise<string | null> {
    return this.warehousesService.getMainWarehouseId(organizationId);
  }
}
