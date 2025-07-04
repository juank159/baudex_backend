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
// ✅ IMPORTAR LA NUEVA ENTIDAD
import { TemporaryProduct } from './entities/temporary-product.entity';
import { ProductRepository } from './repositories/product.repository';
import { CategoryModule } from 'src/categories/categories.module';
import { AuthModule } from '../auth/auth.module';

import { ProductController } from './products.controller';
import { ProductPriceController } from './product-price.controller';
import { ProductAdminController } from './product-admin.controller';
import { ProductService } from './products.service';
import { ProductPriceService } from './product-price.service';
// ✅ IMPORTAR EL NUEVO SERVICIO
import { TemporaryProductService } from './temporary-product.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductPrice,
      TemporaryProduct, // ✅ REGISTRAR LA NUEVA ENTIDAD
    ]),
    CategoryModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [
    ProductController,
    ProductPriceController,
    ProductAdminController,
  ],
  providers: [
    ProductRepository,
    ProductService,
    ProductPriceService,
    TemporaryProductService, // ✅ REGISTRAR EL NUEVO SERVICIO
  ],
  exports: [
    ProductService,
    ProductPriceService,
    ProductRepository,
    TemporaryProductService, // ✅ EXPORTAR EL SERVICIO PARA OTROS MÓDULOS
  ],
})
export class ProductModule {}
