// src/cash-register/cash-register.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { CashRegister } from './entities/cash-register.entity';
import { CashRegisterController } from './cash-register.controller';
import { CashRegisterService } from './cash-register.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashRegister]),
    forwardRef(() => AuthModule),
  ],
  controllers: [CashRegisterController],
  providers: [CashRegisterService, TenantAwareService],
  exports: [CashRegisterService, TypeOrmModule],
})
export class CashRegisterModule {}
