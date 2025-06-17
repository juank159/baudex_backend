import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductPrice } from './entities/product-price.entity';
import { ProductRepository } from './repositories/product.repository';
import { CategoryModule } from 'src/categories/categories.module';
import { AuthModule } from '../auth/auth.module'; // 👈 AGREGAR ESTA LÍNEA

import { ProductController } from './products.controller';
import { ProductPriceController } from './product-price.controller';
import { ProductAdminController } from './product-admin.controller';
import { ProductService } from './products.service';
import { ProductPriceService } from './product-price.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductPrice]),
    CategoryModule,
    UsersModule,
    AuthModule, // 👈 AGREGAR ESTA LÍNEA
  ],
  controllers: [
    ProductController,
    ProductPriceController,
    ProductAdminController,
  ],
  providers: [ProductRepository, ProductService, ProductPriceService],
  exports: [ProductService, ProductPriceService, ProductRepository],
})
export class ProductModule {}
