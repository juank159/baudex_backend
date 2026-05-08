import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Scope,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExpenseCategoriesService } from './expense-categories.service';
import {
  Expense,
  ExpenseStatus,
  ExpensePaidFrom,
} from './entities/expense.entity';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { BankAccountMovementType } from '../bank-accounts/entities/bank-account-movement.entity';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from 'src/common/dto/pagination-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { RejectExpenseDto } from './dto/reject-expense.dto';
import { TenantAwareService } from 'src/common/services/tenant-aware.service';
import { FileUploadService } from 'src/common/services/file-upload.service';
import { User } from 'src/users/entities/user.entity';
import * as path from 'path';

@Injectable({ scope: Scope.REQUEST })
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly categoriesService: ExpenseCategoriesService,
    private readonly tenantService: TenantAwareService,
    private readonly fileUploadService: FileUploadService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly cashRegisterService: CashRegisterService,
  ) {}

  /**
   * Cuando un gasto pasa a `paid` y su `paidFrom` es `bank_account`,
   * descontamos el saldo de la cuenta y generamos un movement auditable
   * `expense_payment`. Para los otros `paidFrom` (cash_register, petty_cash,
   * owner_capital) no tocamos cuentas — esos flujos se cubren en Phase 2
   * (caja registradora) y reportes de capital.
   *
   * Validaciones:
   * - Si paidFrom es bank_account pero no viene bankAccountId → error.
   * - Si la cuenta no existe o no tiene saldo → error (no allowOverdraft).
   *
   * Idempotencia: usa `referenceType='expense'` + `referenceId=expense.id`,
   * así que si por error se llama 2 veces podemos detectar duplicados con
   * un SELECT antes de insertar (TODO si surge en producción).
   */
  private async processExpensePayment(expense: Expense): Promise<void> {
    if (!expense.paidFrom) return;

    // Phase 2: si el gasto se paga con caja del día, validar que haya
    // una caja abierta del tenant. Sin caja abierta, no se puede pagar.
    // El cierre de caja capturará automáticamente este gasto vía la
    // query SQL del rango open→close.
    if (expense.paidFrom === ExpensePaidFrom.CASH_REGISTER) {
      const open = await this.cashRegisterService.getOpenCashRegister(
        expense.organizationId,
      );
      if (!open) {
        throw new BadRequestException(
          'No hay una caja abierta. Para pagar este gasto con la caja del ' +
            'día abre la caja registradora primero, o cambia el origen del ' +
            'pago a cuenta bancaria / caja chica / aporte del dueño.',
        );
      }
      return; // OK, caja abierta; el cierre lo contabilizará
    }

    if (expense.paidFrom !== ExpensePaidFrom.BANK_ACCOUNT) {
      // petty_cash / owner_capital: por ahora solo guardamos
      // el origen como metadata. No hay impacto en saldos del sistema.
      return;
    }
    if (!expense.bankAccountId) {
      throw new BadRequestException(
        'Para paidFrom=bank_account es obligatorio enviar bankAccountId',
      );
    }
    await this.bankAccountsService.updateBalanceById(
      expense.bankAccountId,
      -expense.amount,
      expense.organizationId,
      {
        type: BankAccountMovementType.EXPENSE_PAYMENT,
        description:
          expense.vendor != null && expense.vendor !== ''
            ? `Gasto: ${expense.description} (${expense.vendor})`
            : `Gasto: ${expense.description}`,
        referenceType: 'expense',
        referenceId: expense.id,
        createdById: expense.createdById,
        // Sin overdraft: no permitir que un gasto deje saldo negativo.
        allowOverdraft: false,
      },
    );
  }

  async create(
    createExpenseDto: CreateExpenseDto,
    createdById: string,
  ): Promise<Expense> {
    // Verificar que la categoría existe
    await this.categoriesService.findOne(createExpenseDto.categoryId);

    // Si declara paidFrom, el gasto YA salió de algún lado: marcarlo como
    // pagado automáticamente (a menos que explícitamente se haya elegido
    // draft/pending para diferir el pago).
    let resolvedStatus = createExpenseDto.status || ExpenseStatus.APPROVED;
    if (createExpenseDto.paidFrom != null) {
      if (
        resolvedStatus !== ExpenseStatus.DRAFT &&
        resolvedStatus !== ExpenseStatus.PENDING
      ) {
        resolvedStatus = ExpenseStatus.PAID;
      }
    }

    const expenseData = {
      ...createExpenseDto,
      name: createExpenseDto.description,
      date: createExpenseDto.date
        ? new Date(createExpenseDto.date)
        : new Date(),
      createdById,
      status: resolvedStatus,
    };

    const expense = this.expenseRepository.create({
      ...expenseData,
      organizationId: this.tenantService.getTenantId()!,
    });
    const saved = await this.expenseRepository.save(expense);

    // Si el gasto se crea ya como `paid` y tiene paidFrom=bank_account,
    // procesamos el pago: descontar saldo + generar movement.
    if (saved.status === ExpenseStatus.PAID) {
      await this.processExpensePayment(saved);
    }
    return saved;
  }

  async findAll(
    query: ExpenseQueryDto,
  ): Promise<PaginatedResponseDto<Expense>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      paymentMethod,
      categoryId,
      createdById,
      vendor,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      tags,
      sortBy = 'date',
      sortOrder = 'DESC',
      orderBy,
      orderDirection,
    } = query;

    const queryBuilder = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.category', 'category')
      .leftJoinAndSelect('expense.createdBy', 'createdBy')
      .leftJoinAndSelect('expense.approvedBy', 'approvedBy');

    // Aplicar filtro de tenant automáticamente
    this.tenantService.addTenantFilterToQueryBuilder(queryBuilder, 'expense');

    // Filtros
    if (search) {
      queryBuilder.andWhere(
        '(expense.description ILIKE :search OR expense.vendor ILIKE :search OR expense.invoiceNumber ILIKE :search OR expense.reference ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('expense.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('expense.type = :type', { type });
    }

    if (paymentMethod) {
      queryBuilder.andWhere('expense.paymentMethod = :paymentMethod', {
        paymentMethod,
      });
    }

    if (categoryId) {
      queryBuilder.andWhere('expense.categoryId = :categoryId', { categoryId });
    }

    if (createdById) {
      queryBuilder.andWhere('expense.createdById = :createdById', {
        createdById,
      });
    }

    if (vendor) {
      queryBuilder.andWhere('expense.vendor ILIKE :vendor', {
        vendor: `%${vendor}%`,
      });
    }

    if (startDate) {
      queryBuilder.andWhere('expense.date >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('expense.date <= :endDate', { endDate });
    }

    if (minAmount !== undefined) {
      queryBuilder.andWhere('expense.amount >= :minAmount', { minAmount });
    }

    if (maxAmount !== undefined) {
      queryBuilder.andWhere('expense.amount <= :maxAmount', { maxAmount });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('expense.tags @> :tags', {
        tags: JSON.stringify(tags),
      });
    }

    // Ordenamiento - usar orderBy/orderDirection si están presentes, sino usar sortBy/sortOrder
    const finalSortBy = orderBy || sortBy;
    const finalSortOrder = orderDirection || sortOrder;
    queryBuilder.orderBy(`expense.${finalSortBy}`, finalSortOrder);

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

  async findOne(id: string): Promise<Expense> {
    const queryBuilder = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.category', 'category')
      .leftJoinAndSelect('expense.createdBy', 'createdBy')
      .leftJoinAndSelect('expense.approvedBy', 'approvedBy')
      .where('expense.id = :id', { id });

    // Aplicar filtro de tenant automáticamente
    this.tenantService.addTenantFilterToQueryBuilder(queryBuilder, 'expense');

    const expense = await queryBuilder.getOne();

    if (!expense) {
      throw new NotFoundException('Gasto no encontrado');
    }

    return expense;
  }

  async update(
    id: string,
    updateExpenseDto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.findOne(id);

    // No permitir editar gastos aprobados o pagados
    if (
      expense.status === ExpenseStatus.APPROVED ||
      expense.status === ExpenseStatus.PAID
    ) {
      throw new BadRequestException(
        'No se puede editar un gasto aprobado o pagado',
      );
    }

    // Verificar categoría si se está actualizando
    if (updateExpenseDto.categoryId) {
      await this.categoriesService.findOne(updateExpenseDto.categoryId);
    }

    Object.assign(expense, updateExpenseDto);

    if (updateExpenseDto.description) {
      expense.name = updateExpenseDto.description;
    }

    if (updateExpenseDto.date) {
      expense.date = new Date(updateExpenseDto.date);
    }

    return this.expenseRepository.save(expense);
  }

  async submit(id: string): Promise<Expense> {
    const expense = await this.findOne(id);

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden enviar gastos en borrador');
    }

    expense.status = expense.requiresApproval
      ? ExpenseStatus.PENDING
      : ExpenseStatus.APPROVED;

    // Si no requiere aprobación, marcarlo como aprobado automáticamente
    if (!expense.requiresApproval) {
      expense.approvedAt = new Date();
    }

    return this.expenseRepository.save(expense);
  }

  async approve(
    id: string,
    approveDto: ApproveExpenseDto,
    approverId: string,
  ): Promise<Expense> {
    const expense = await this.findOne(id);

    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException('Solo se pueden aprobar gastos pendientes');
    }

    expense.status = ExpenseStatus.APPROVED;
    expense.approvedById = approverId;
    expense.approvedAt = new Date();

    if (approveDto.notes) {
      expense.notes =
        (expense.notes || '') + '\n\nNotas de aprobación: ' + approveDto.notes;
    }

    return this.expenseRepository.save(expense);
  }

  async reject(
    id: string,
    rejectDto: RejectExpenseDto,
    approverId: string,
  ): Promise<Expense> {
    const expense = await this.findOne(id);

    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(
        'Solo se pueden rechazar gastos pendientes',
      );
    }

    expense.status = ExpenseStatus.REJECTED;
    expense.approvedById = approverId;
    expense.approvedAt = new Date();
    expense.rejectionReason = rejectDto.rejectionReason;

    return this.expenseRepository.save(expense);
  }

  async markAsPaid(
    id: string,
    payload?: { paidFrom?: ExpensePaidFrom; bankAccountId?: string },
  ): Promise<Expense> {
    const expense = await this.findOne(id);

    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException(
        'Solo se pueden marcar como pagados los gastos aprobados',
      );
    }

    // Permitir definir/sobrescribir paidFrom + bankAccountId al pagar.
    if (payload?.paidFrom != null) {
      expense.paidFrom = payload.paidFrom;
    }
    if (payload?.bankAccountId != null) {
      expense.bankAccountId = payload.bankAccountId;
    }

    expense.status = ExpenseStatus.PAID;
    const saved = await this.expenseRepository.save(expense);
    await this.processExpensePayment(saved);
    return saved;
  }

  async softDelete(id: string): Promise<{ message: string }> {
    const expense = await this.findOne(id);

    if (expense.status === ExpenseStatus.PAID) {
      throw new BadRequestException('No se puede eliminar un gasto pagado');
    }

    await this.expenseRepository.softRemove(expense);
    return { message: 'Gasto eliminado exitosamente' };
  }

  async getStats(): Promise<{
    total: number;
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
    paid: number;
    totalAmount: number;
    monthlyAmount: number;
    pendingAmount: number;
    averageAmount: number;
  }> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) {
      throw new Error('No se pudo determinar la organización');
    }

    const total = await this.expenseRepository.count({
      where: { organizationId: tenantId },
    });
    const draft = await this.expenseRepository.count({
      where: { status: ExpenseStatus.DRAFT, organizationId: tenantId },
    });
    const pending = await this.expenseRepository.count({
      where: { status: ExpenseStatus.PENDING, organizationId: tenantId },
    });
    const approved = await this.expenseRepository.count({
      where: { status: ExpenseStatus.APPROVED, organizationId: tenantId },
    });
    const rejected = await this.expenseRepository.count({
      where: { status: ExpenseStatus.REJECTED, organizationId: tenantId },
    });
    const paid = await this.expenseRepository.count({
      where: { status: ExpenseStatus.PAID, organizationId: tenantId },
    });

    // Montos totales
    const totalResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalAmount')
      .addSelect('AVG(expense.amount)', 'averageAmount')
      .where('expense.status IN (:...statuses)', {
        statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
      })
      .andWhere('expense.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .getRawOne();

    // Gastos del mes actual
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    const monthlyResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'monthlyAmount')
      .where('expense.date >= :startDate', { startDate: startOfMonth })
      .andWhere('expense.date <= :endDate', { endDate: endOfMonth })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
      })
      .andWhere('expense.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .getRawOne();

    // Gastos pendientes de pago
    const pendingResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'pendingAmount')
      .where('expense.status = :status', { status: ExpenseStatus.APPROVED })
      .andWhere('expense.organizationId = :organizationId', {
        organizationId: tenantId,
      })
      .getRawOne();

    return {
      total,
      draft,
      pending,
      approved,
      rejected,
      paid,
      totalAmount: parseFloat(totalResult.totalAmount) || 0,
      monthlyAmount: parseFloat(monthlyResult.monthlyAmount) || 0,
      pendingAmount: parseFloat(pendingResult.pendingAmount) || 0,
      averageAmount: parseFloat(totalResult.averageAmount) || 0,
    };
  }

  async getExpensesByCategory(year?: number, month?: number): Promise<any[]> {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    const tenantId = this.tenantService.getTenantId();
    return this.expenseRepository
      .createQueryBuilder('expense')
      .select('category.name', 'categoryName')
      .addSelect('category.color', 'categoryColor')
      .addSelect('SUM(expense.amount)', 'totalAmount')
      .addSelect('COUNT(expense.id)', 'count')
      .leftJoin('expense.category', 'category')
      .where('expense.organizationId = :tenantId', { tenantId })
      .andWhere('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
      })
      .groupBy('category.id')
      .addGroupBy('category.name')
      .addGroupBy('category.color')
      .orderBy('totalAmount', 'DESC')
      .getRawMany();
  }

  async getMonthlyTrend(months: number = 12): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);

    const tenantId = this.tenantService.getTenantId();
    return this.expenseRepository
      .createQueryBuilder('expense')
      .select("DATE_TRUNC('month', expense.date)", 'month')
      .addSelect('SUM(expense.amount)', 'totalAmount')
      .addSelect('COUNT(expense.id)', 'count')
      .where('expense.organizationId = :tenantId', { tenantId })
      .andWhere('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
      })
      .groupBy("DATE_TRUNC('month', expense.date)")
      .orderBy('month', 'ASC')
      .getRawMany();
  }

  async uploadAttachments(
    id: string,
    files: Express.Multer.File[],
    user: User,
  ): Promise<{ attachmentUrls: string[] }> {
    const expense = await this.findOne(id);

    if (!files || files.length === 0) {
      throw new BadRequestException('No se enviaron archivos');
    }

    // Validate each file
    files.forEach((file) => {
      this.fileUploadService.validateAttachmentFile(file);
    });

    // Get existing attachments or initialize empty array
    const existingAttachments = expense.attachments || [];

    // Add new file names to attachments
    const newAttachments = files.map((file) => file.filename);
    const allAttachments = [...existingAttachments, ...newAttachments];

    // Update expense with new attachments
    expense.attachments = allAttachments;
    await this.expenseRepository.save(expense);

    // Return URLs for frontend
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const attachmentUrls = newAttachments.map(
      (filename) => `${baseUrl}/expenses/${id}/attachments/${filename}`,
    );

    return { attachmentUrls };
  }

  async deleteAttachment(
    id: string,
    filename: string,
    user: User,
  ): Promise<void> {
    const expense = await this.findOne(id);

    if (!expense.attachments || !expense.attachments.includes(filename)) {
      throw new NotFoundException('Adjunto no encontrado');
    }

    // Remove from expense attachments
    expense.attachments = expense.attachments.filter((f) => f !== filename);
    await this.expenseRepository.save(expense);

    // Delete physical file
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'attachments',
      filename,
    );
    await this.fileUploadService.deleteFile(filePath);
  }
}
