import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExpenseCategoriesService } from './expense-categories.service';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from 'src/common/dto/pagination-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { RejectExpenseDto } from './dto/reject-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly categoriesService: ExpenseCategoriesService,
  ) {}

  async create(
    createExpenseDto: CreateExpenseDto,
    createdById: string,
  ): Promise<Expense> {
    // Verificar que la categoría existe
    await this.categoriesService.findOne(createExpenseDto.categoryId);

    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      date: createExpenseDto.date
        ? new Date(createExpenseDto.date)
        : new Date(),
      createdById,
      status: ExpenseStatus.DRAFT,
    });

    return this.expenseRepository.save(expense);
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
    } = query;

    const queryBuilder = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.category', 'category')
      .leftJoinAndSelect('expense.createdBy', 'createdBy')
      .leftJoinAndSelect('expense.approvedBy', 'approvedBy');

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

    // Ordenamiento
    queryBuilder.orderBy(`expense.${sortBy}`, sortOrder);

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
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: ['category', 'createdBy', 'approvedBy'],
    });

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

  async markAsPaid(id: string): Promise<Expense> {
    const expense = await this.findOne(id);

    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException(
        'Solo se pueden marcar como pagados los gastos aprobados',
      );
    }

    expense.status = ExpenseStatus.PAID;
    return this.expenseRepository.save(expense);
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
    const total = await this.expenseRepository.count();
    const draft = await this.expenseRepository.count({
      where: { status: ExpenseStatus.DRAFT },
    });
    const pending = await this.expenseRepository.count({
      where: { status: ExpenseStatus.PENDING },
    });
    const approved = await this.expenseRepository.count({
      where: { status: ExpenseStatus.APPROVED },
    });
    const rejected = await this.expenseRepository.count({
      where: { status: ExpenseStatus.REJECTED },
    });
    const paid = await this.expenseRepository.count({
      where: { status: ExpenseStatus.PAID },
    });

    // Montos totales
    const totalResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalAmount')
      .addSelect('AVG(expense.amount)', 'averageAmount')
      .where('expense.status IN (:...statuses)', {
        statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
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
      .getRawOne();

    // Gastos pendientes de pago
    const pendingResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'pendingAmount')
      .where('expense.status = :status', { status: ExpenseStatus.APPROVED })
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

    return this.expenseRepository
      .createQueryBuilder('expense')
      .select('category.name', 'categoryName')
      .addSelect('category.color', 'categoryColor')
      .addSelect('SUM(expense.amount)', 'totalAmount')
      .addSelect('COUNT(expense.id)', 'count')
      .leftJoin('expense.category', 'category')
      .where('expense.date >= :startDate', { startDate })
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

    return this.expenseRepository
      .createQueryBuilder('expense')
      .select("DATE_TRUNC('month', expense.date)", 'month')
      .addSelect('SUM(expense.amount)', 'totalAmount')
      .addSelect('COUNT(expense.id)', 'count')
      .where('expense.date >= :startDate', { startDate })
      .andWhere('expense.date <= :endDate', { endDate })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
      })
      .groupBy("DATE_TRUNC('month', expense.date)")
      .orderBy('month', 'ASC')
      .getRawMany();
  }
}
