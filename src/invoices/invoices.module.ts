// import { Module, forwardRef } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { InvoicesService } from './invoices.service';
// import { InvoicesController } from './invoices.controller';
// import { Invoice } from './entities/invoice.entity';
// import { InvoiceItem } from './entities/invoice-item.entity';
// import { AuthModule } from '../auth/auth.module';
// import { CustomersModule } from '../customers/customers.module';
// import { ProductModule } from 'src/products/products.module';

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([Invoice, InvoiceItem]),
//     forwardRef(() => AuthModule),
//     forwardRef(() => CustomersModule),
//     forwardRef(() => ProductModule),
//   ],
//   controllers: [InvoicesController],
//   providers: [InvoicesService],
//   exports: [InvoicesService, TypeOrmModule],
// })
// export class InvoicesModule {}

// src/invoices/invoices.module.ts - CORREGIDO

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { ProductModule } from 'src/products/products.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem]),
    forwardRef(() => AuthModule),
    forwardRef(() => CustomersModule),
    // ✅ IMPORTANTE: NO usar forwardRef para ProductModule
    // porque necesitamos el TemporaryProductService
    ProductModule, // ✅ CAMBIAR ESTO - sin forwardRef
    CommonModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService, TypeOrmModule],
})
export class InvoicesModule {}
