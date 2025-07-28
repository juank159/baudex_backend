import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { AuthModule } from '../auth/auth.module';
import { ExpensesController } from './expenses.controller';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesService } from './expense-categories.service';
import { TenantAwareService } from '../common/services/tenant-aware.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpenseCategory]),
    forwardRef(() => AuthModule),
  ],
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [ExpensesService, ExpenseCategoriesService, TenantAwareService],
  exports: [ExpensesService, ExpenseCategoriesService, TypeOrmModule],
})
export class ExpensesModule {}
