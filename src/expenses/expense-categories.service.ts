import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExpenseCategory,
  ExpenseCategoryStatus,
} from './entities/expense-category.entity';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepository: Repository<ExpenseCategory>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async create(
    createCategoryDto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    // Verificar si el nombre ya existe
    const existingCategory = await this.categoryRepository.findOne({
      where: { name: createCategoryDto.name },
    });

    if (existingCategory) {
      throw new ConflictException('Ya existe una categoría con este nombre');
    }

    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  async findAll(): Promise<ExpenseCategory[]> {
    return this.categoryRepository.find({
      where: { status: ExpenseCategoryStatus.ACTIVE },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findAllWithStats(): Promise<ExpenseCategory[]> {
    const categories = await this.categoryRepository.find({
      where: { status: ExpenseCategoryStatus.ACTIVE },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // Calcular estadísticas para cada categoría
    for (const category of categories) {
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

      const monthlySpent = await this.expenseRepository
        .createQueryBuilder('expense')
        .select('SUM(expense.amount)', 'total')
        .where('expense.categoryId = :categoryId', { categoryId: category.id })
        .andWhere('expense.date >= :startDate', { startDate: startOfMonth })
        .andWhere('expense.date <= :endDate', { endDate: endOfMonth })
        .andWhere('expense.status IN (:...statuses)', {
          statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
        })
        .getRawOne();

      (category as any).monthlySpent = parseFloat(monthlySpent.total) || 0;
      (category as any).budgetUtilization =
        category.monthlyBudget > 0
          ? ((category as any).monthlySpent / category.monthlyBudget) * 100
          : 0;
    }

    return categories;
  }

  async findOne(id: string): Promise<ExpenseCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoría de gasto no encontrada');
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const category = await this.findOne(id);

    // Verificar nombre único si se está actualizando
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { name: updateCategoryDto.name },
      });
      if (existingCategory) {
        throw new ConflictException('Ya existe una categoría con este nombre');
      }
    }

    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.save(category);
  }

  async softDelete(id: string): Promise<{ message: string }> {
    const category = await this.findOne(id);

    // No permitir eliminar categorías requeridas
    if (category.isRequired) {
      throw new BadRequestException(
        'No se puede eliminar una categoría requerida',
      );
    }

    // Verificar si tiene gastos asociados
    const expenseCount = await this.expenseRepository.count({
      where: { categoryId: id },
    });

    if (expenseCount > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría que tiene gastos asociados',
      );
    }

    await this.categoryRepository.softRemove(category);
    return { message: 'Categoría eliminada exitosamente' };
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalBudget: number;
    totalSpent: number;
  }> {
    const total = await this.categoryRepository.count();
    const active = await this.categoryRepository.count({
      where: { status: ExpenseCategoryStatus.ACTIVE },
    });
    const inactive = await this.categoryRepository.count({
      where: { status: ExpenseCategoryStatus.INACTIVE },
    });

    const budgetResult = await this.categoryRepository
      .createQueryBuilder('category')
      .select('SUM(category.monthlyBudget)', 'totalBudget')
      .where('category.status = :status', {
        status: ExpenseCategoryStatus.ACTIVE,
      })
      .getRawOne();

    // Calcular gasto total del mes actual
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

    const spentResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'totalSpent')
      .where('expense.date >= :startDate', { startDate: startOfMonth })
      .andWhere('expense.date <= :endDate', { endDate: endOfMonth })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: [ExpenseStatus.APPROVED, ExpenseStatus.PAID],
      })
      .getRawOne();

    return {
      total,
      active,
      inactive,
      totalBudget: parseFloat(budgetResult.totalBudget) || 0,
      totalSpent: parseFloat(spentResult.totalSpent) || 0,
    };
  }
}
