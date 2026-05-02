// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { Product } from './entities/product.entity';
// import { ProductPrice } from './entities/product-price.entity';
// import { ProductRepository } from './repositories/product.repository';
// import { CategoryModule } from 'src/categories/categories.module';
// import { AuthModule } from '../auth/auth.module'; // 👈 AGREGAR ESTA LÍNEA

// import { ProductController } from './products.controller';
// import { ProductPriceController } from './product-price.controller';
// import { ProductAdminController } from './product-admin.controller';
// import { ProductService } from './products.service';
// import { ProductPriceService } from './product-price.service';
// import { UsersModule } from 'src/users/users.module';

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([Product, ProductPrice]),
//     CategoryModule,
//     UsersModule,
//     AuthModule, // 👈 AGREGAR ESTA LÍNEA
//   ],
//   controllers: [
//     ProductController,
//     ProductPriceController,
//     ProductAdminController,
//   ],
//   providers: [ProductRepository, ProductService, ProductPriceService],
//   exports: [ProductService, ProductPriceService, ProductRepository],
// })
// export class ProductModule {}

// src/products/products.module.ts - CORREGIDO

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductPrice } from './entities/product-price.entity';
import { ProductPresentation } from './entities/product-presentation.entity';
import { TemporaryProduct } from './entities/temporary-product.entity';
import { ProductRepository } from './repositories/product.repository';
import { CategoryModule } from 'src/categories/categories.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { ProductController } from './products.controller';
import { ProductPriceController } from './product-price.controller';
import { ProductPresentationController } from './product-presentation.controller';
import { ProductAdminController } from './product-admin.controller';
import { ProductService } from './products.service';
import { ProductPriceService } from './product-price.service';
import { ProductPresentationService } from './product-presentation.service';
import { TemporaryProductService } from './temporary-product.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductPrice,
      ProductPresentation,
      TemporaryProduct,
    ]),
    CategoryModule,
    UsersModule,
    AuthModule,
    SubscriptionsModule,
  ],
  controllers: [
    ProductController,
    ProductPriceController,
    ProductPresentationController,
    ProductAdminController,
  ],
  providers: [
    ProductRepository,
    ProductService,
    ProductPriceService,
    ProductPresentationService,
    TemporaryProductService,
  ],
  exports: [
    ProductService,
    ProductPriceService,
    ProductPresentationService,
    ProductRepository,
    TemporaryProductService,
  ],
})
export class ProductModule {}
