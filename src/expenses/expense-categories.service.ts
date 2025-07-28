import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Scope,
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
import { TenantAwareService } from 'src/common/services/tenant-aware.service';

@Injectable({ scope: Scope.REQUEST })
export class ExpenseCategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepository: Repository<ExpenseCategory>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly tenantService: TenantAwareService,
  ) {}

  async create(
    createCategoryDto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    // Verificar si el nombre ya existe en la organización actual
    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.name = :name', { name: createCategoryDto.name });
    
    this.tenantService.addTenantFilterToQueryBuilder(queryBuilder, 'category');
    const existingCategory = await queryBuilder.getOne();

    if (existingCategory) {
      throw new ConflictException('Ya existe una categoría con este nombre');
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      organizationId: this.tenantService.getTenantId()!,
    });
    return this.categoryRepository.save(category);
  }

  async findAll(): Promise<ExpenseCategory[]> {
    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.status = :status', { status: ExpenseCategoryStatus.ACTIVE })
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC');

    this.tenantService.addTenantFilterToQueryBuilder(queryBuilder, 'category');
    return queryBuilder.getMany();
  }

  async findAllWithStats(): Promise<ExpenseCategory[]> {
    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.status = :status', { status: ExpenseCategoryStatus.ACTIVE })
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC');

    this.tenantService.addTenantFilterToQueryBuilder(queryBuilder, 'category');
    const categories = await queryBuilder.getMany();

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
    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.id = :id', { id });

    this.tenantService.addTenantFilterToQueryBuilder(queryBuilder, 'category');
    const category = await queryBuilder.getOne();

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

  // Método para crear categorías por defecto
  async seedDefaultCategories(): Promise<{ message: string; created: number }> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No se pudo determinar la organización actual');
    }

    // Verificar si ya existen categorías
    const existingCount = await this.categoryRepository.count({
      where: { organizationId: tenantId },
    });

    if (existingCount > 0) {
      return {
        message: 'Ya existen categorías para esta organización',
        created: 0,
      };
    }

    const defaultCategories = [
      {
        name: 'Alimentación',
        description: 'Gastos en alimentos, restaurantes y comidas de trabajo',
        color: '#FF6B6B',
        monthlyBudget: 500000,
        sortOrder: 1,
      },
      {
        name: 'Transporte',
        description: 'Gastos en combustible, taxis, Uber, transporte público',
        color: '#4ECDC4',
        monthlyBudget: 300000,
        sortOrder: 2,
      },
      {
        name: 'Hospedaje',
        description: 'Gastos en hoteles y alojamiento para viajes de trabajo',
        color: '#45B7D1',
        monthlyBudget: 800000,
        sortOrder: 3,
      },
      {
        name: 'Materiales y Suministros',
        description: 'Compra de materiales de oficina, suministros y herramientas',
        color: '#96CEB4',
        monthlyBudget: 400000,
        sortOrder: 4,
      },
      {
        name: 'Capacitación',
        description: 'Cursos, seminarios, entrenamientos y desarrollo profesional',
        color: '#FECA57',
        monthlyBudget: 600000,
        sortOrder: 5,
      },
      {
        name: 'Tecnología',
        description: 'Software, hardware, licencias y servicios tecnológicos',
        color: '#FF9FF3',
        monthlyBudget: 1000000,
        sortOrder: 6,
      },
      {
        name: 'Otros Gastos',
        description: 'Gastos varios que no encajan en otras categorías',
        color: '#6C757D',
        monthlyBudget: 300000,
        sortOrder: 7,
      },
    ];

    let created = 0;
    for (const categoryData of defaultCategories) {
      const category = this.categoryRepository.create({
        ...categoryData,
        organizationId: tenantId,
        status: ExpenseCategoryStatus.ACTIVE,
        isRequired: false,
      });

      await this.categoryRepository.save(category);
      created++;
    }

    return {
      message: `Se crearon ${created} categorías por defecto`,
      created,
    };
  }
}
