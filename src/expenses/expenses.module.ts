import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { AuthModule } from '../auth/auth.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';
import { ExpensesController } from './expenses.controller';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesService } from './expense-categories.service';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { FileUploadService } from '../common/services/file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpenseCategory]),
    forwardRef(() => AuthModule),
    BankAccountsModule,
    CashRegisterModule,
  ],
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
    TenantAwareService,
    FileUploadService,
  ],
  exports: [ExpensesService, ExpenseCategoriesService, TypeOrmModule],
})
export class ExpensesModule {}
