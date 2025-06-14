import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Expense } from './expense.entity';

export enum ExpenseCategoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('expense_categories')
export class ExpenseCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color?: string; // Código hexadecimal para UI

  @Column({
    type: 'enum',
    enum: ExpenseCategoryStatus,
    default: ExpenseCategoryStatus.ACTIVE,
  })
  status: ExpenseCategoryStatus;

  // Presupuesto mensual para esta categoría
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monthlyBudget: number;

  @Column({ type: 'boolean', default: false })
  isRequired: boolean; // Categoría obligatoria que no se puede eliminar

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  // Relaciones
  @OneToMany(() => Expense, (expense) => expense.category)
  expenses: Expense[];

  // Métodos útiles
  get isActive(): boolean {
    return this.status === ExpenseCategoryStatus.ACTIVE && !this.deletedAt;
  }

  // Método para calcular gastos del mes actual
  async getCurrentMonthSpent(): Promise<number> {
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

    // Este cálculo se haría en el service, aquí es solo referencia
    return 0;
  }

  get budgetUtilizationPercentage(): number {
    if (this.monthlyBudget <= 0) return 0;
    // Este cálculo se haría en el service con los gastos reales
    return 0;
  }
}
