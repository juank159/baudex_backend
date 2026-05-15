// src/customer-credits/customer-credits.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerCreditsController } from './customer-credits.controller';
import { ClientBalanceController } from './client-balance.controller';
import { CustomerCreditsService } from './customer-credits.service';
import { ClientBalanceService } from './client-balance.service';
import { CustomerCredit } from './entities/customer-credit.entity';
import { CreditPayment } from './entities/credit-payment.entity';
import { ClientBalance } from './entities/client-balance.entity';
import { ClientBalanceTransaction } from './entities/client-balance-transaction.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { CustomersModule } from '../customers/customers.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerCredit,
      CreditPayment,
      ClientBalance,
      ClientBalanceTransaction,
      CreditTransaction,
      Invoice, // Para sincronizar facturas cuando se paga un crédito
      Organization, // Para leer settings.cashRegisterEnabled al validar caja
    ]),
    AuthModule,
    CommonModule,
    forwardRef(() => CustomersModule),
    CashRegisterModule, // Validar caja abierta en pagos cash
  ],
  controllers: [CustomerCreditsController, ClientBalanceController],
  providers: [CustomerCreditsService, ClientBalanceService],
  exports: [CustomerCreditsService, ClientBalanceService],
})
export class CustomerCreditsModule {}
