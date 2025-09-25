import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { UniqueSupplierDocumentConstraint } from './validators/unique-supplier-document.validator';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier])],
  controllers: [SuppliersController],
  providers: [SuppliersService, UniqueSupplierDocumentConstraint],
  exports: [SuppliersService],
})
export class SuppliersModule {}
