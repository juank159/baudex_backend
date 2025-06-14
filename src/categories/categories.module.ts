import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

import { Category } from './entities/category.entity';
import { CategoryRepository } from './repositories/category.repository';
import { CategoryController } from './categories.controller';
import { CategoryAdminController } from './category-admin.controller';
import { CategoryService } from './categories.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category]),
    PassportModule.register({ defaultStrategy: 'jwt' }), // 👈 CRÍTICO: Agregar esto
    CommonModule, // 👈 Para SlugService y otros servicios comunes
  ],
  controllers: [CategoryController, CategoryAdminController],
  providers: [CategoryRepository, CategoryService],
  exports: [CategoryService, CategoryRepository],
})
export class CategoryModule {}
