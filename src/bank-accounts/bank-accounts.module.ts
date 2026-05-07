// src/bank-accounts/bank-accounts.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccount } from './entities/bank-account.entity';
import { BankAccountMovement } from './entities/bank-account-movement.entity';
import { Payment } from '../invoices/entities/payment.entity';
import { CreditPayment } from '../customer-credits/entities/credit-payment.entity';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BankAccount, BankAccountMovement, Payment, CreditPayment]),
    forwardRef(() => AuthModule),
    CommonModule,
  ],
  controllers: [BankAccountsController],
  providers: [BankAccountsService],
  exports: [BankAccountsService, TypeOrmModule],
})
export class BankAccountsModule {}
