// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Patch,
//   Param,
//   Delete,
//   Query,
//   HttpCode,
//   HttpStatus,
//   UseInterceptors,
//   ParseUUIDPipe,
//   UseGuards,
//   BadRequestException,
//   ForbiddenException,
// } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
// import { CategoryService } from './categories.service';
// import { CreateCategoryDto } from './dto/create-category.dto';
// import { CategoryResponseDto } from './dto/category-response.dto';
// import { CategoryQueryDto } from './dto/category-query.dto';
// import { CategoryTreeDto } from './dto/category-tree.dto';
// import { UpdateCategoryDto } from './dto/update-category.dto';
// import { CategoryStatus } from './entities/category.entity';
// import { GetUser } from '../auth/decorators/get-user.decorator';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { User, UserRole } from '../users/entities/user.entity';

// @Controller('categories')
// @UseInterceptors(new TransformInterceptor(CategoryResponseDto))
// export class CategoryController {
//   constructor(private readonly categoryService: CategoryService) {}

//   // ==================== ENDPOINTS PÚBLICOS ====================

//   @Get()
//   async findAll(@Query() query: CategoryQueryDto) {
//     return this.categoryService.findAll(query);
//   }

//   @Get('tree')
//   @UseInterceptors(new TransformInterceptor(CategoryTreeDto))
//   async getTree(): Promise<CategoryTreeDto[]> {
//     return this.categoryService.findTree();
//   }

//   @Get('stats')
//   async getStats() {
//     return this.categoryService.getStats();
//   }

//   @Get('search')
//   async search(
//     @Query('q') searchTerm: string,
//     @Query('limit') limit: number = 10,
//   ) {
//     if (!searchTerm || searchTerm.trim().length < 2) {
//       throw new BadRequestException(
//         'El término de búsqueda debe tener al menos 2 caracteres',
//       );
//     }
//     return this.categoryService.search(searchTerm, limit);
//   }

//   @Get('slug/:slug')
//   async findBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
//     return this.categoryService.findBySlug(slug);
//   }

//   @Get(':id')
//   async findOne(
//     @Param('id', ParseUUIDPipe) id: string,
//   ): Promise<CategoryResponseDto> {
//     return this.categoryService.findOne(id);
//   }

//   @Get(':id/children')
//   async getChildren(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Query() query: CategoryQueryDto,
//   ) {
//     // Configurar query para obtener solo hijos
//     query.parentId = id;
//     return this.categoryService.findAll(query);
//   }

//   // ==================== ENDPOINTS PROTEGIDOS ====================

//   @Get(':id/products')
//   @UseGuards(AuthGuard())
//   async getCategoryProducts(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Query() query: any,
//   ) {
//     // Verificar que la categoría existe
//     await this.categoryService.findOne(id);

//     // TODO: Implementar cuando tengamos el ProductController
//     return {
//       data: [],
//       meta: {
//         page: query.page || 1,
//         limit: query.limit || 10,
//         totalItems: 0,
//         totalPages: 0,
//         hasNextPage: false,
//         hasPreviousPage: false,
//       },
//       message: 'Integración con productos pendiente de implementar',
//     };
//   }

//   @Post()
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
//   @HttpCode(HttpStatus.CREATED)
//   async create(
//     @Body() createCategoryDto: CreateCategoryDto,
//   ): Promise<CategoryResponseDto> {
//     return this.categoryService.create(createCategoryDto);
//   }

//   @Patch(':id')
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   async update(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body() updateCategoryDto: UpdateCategoryDto,
//   ): Promise<CategoryResponseDto> {
//     return this.categoryService.update(id, updateCategoryDto);
//   }

//   @Patch(':id/status')
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   async updateStatus(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body('status') status: CategoryStatus,
//     @GetUser() user: User,
//     @Body('reason') reason?: string,
//   ): Promise<CategoryResponseDto> {
//     return this.categoryService.updateStatus(id, status);
//   }

//   @Post('reorder')
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @HttpCode(HttpStatus.NO_CONTENT)
//   async reorderCategories(
//     @Body() categoryOrders: { id: string; sortOrder: number }[],
//   ): Promise<void> {
//     return this.categoryService.reorderCategories(categoryOrders);
//   }

//   @Delete(':id')
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @HttpCode(HttpStatus.NO_CONTENT)
//   async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
//     return this.categoryService.softDelete(id);
//   }

//   @Post(':id/restore')
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN)
//   async restore(
//     @Param('id', ParseUUIDPipe) id: string,
//   ): Promise<CategoryResponseDto> {
//     return this.categoryService.restore(id);
//   }

//   // ==================== ENDPOINTS DE VALIDACIÓN ====================

//   @Get('slug/:slug/available')
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   async checkSlugAvailability(
//     @Param('slug') slug: string,
//     @Query('excludeId') excludeId?: string,
//   ) {
//     const isAvailable = await this.categoryService.isSlugAvailable(
//       slug,
//       excludeId,
//     );

//     return {
//       slug,
//       available: isAvailable,
//       message: isAvailable ? 'Slug disponible' : 'Slug ya está en uso',
//     };
//   }

//   @Post('validate-hierarchy')
//   @UseGuards(AuthGuard(), RolesGuard)
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   async validateHierarchy(
//     @Body('categoryId') categoryId: string,
//     @Body('newParentId') newParentId?: string,
//   ) {
//     // Validar que no se cree un ciclo
//     if (newParentId) {
//       const isDescendant = await this.categoryService['isDescendant'](
//         categoryId,
//         newParentId,
//       );
//       return {
//         valid: !isDescendant,
//         wouldCreateCycle: isDescendant,
//         message: isDescendant
//           ? 'Esta operación crearía un ciclo en la jerarquía'
//           : 'Jerarquía válida',
//       };
//     }

//     return { valid: true, message: 'Jerarquía válida' };
//   }
// }

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { PaginatedTransformInterceptor } from 'src/common/interceptors/paginated-transform.interceptor'; // 👈 NUEVO IMPORT
import { CategoryService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryTreeDto } from './dto/category-tree.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryStatus } from './entities/category.entity';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ==================== ENDPOINTS PÚBLICOS ====================

  @Get()
  @UseInterceptors(new PaginatedTransformInterceptor(CategoryResponseDto)) // 👈 CAMBIO AQUÍ
  async findAll(@Query() query: CategoryQueryDto) {
    return this.categoryService.findAll(query);
  }

  @Get('tree')
  @UseInterceptors(new TransformInterceptor(CategoryTreeDto))
  async getTree(): Promise<CategoryTreeDto[]> {
    return this.categoryService.findTree();
  }

  @Get('stats')
  async getStats() {
    return this.categoryService.getStats();
  }

  @Get('search')
  @UseInterceptors(new TransformInterceptor(CategoryResponseDto)) // Para array simple
  async search(
    @Query('q') searchTerm: string,
    @Query('limit') limit: number = 10,
  ) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException(
        'El término de búsqueda debe tener al menos 2 caracteres',
      );
    }
    return this.categoryService.search(searchTerm, limit);
  }

  @Get('slug/:slug')
  @UseInterceptors(new TransformInterceptor(CategoryResponseDto))
  async findBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoryService.findBySlug(slug);
  }

  @Get(':id')
  @UseInterceptors(new TransformInterceptor(CategoryResponseDto))
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.findOne(id);
  }

  @Get(':id/children')
  @UseInterceptors(new PaginatedTransformInterceptor(CategoryResponseDto)) // 👈 CAMBIO AQUÍ
  async getChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CategoryQueryDto,
  ) {
    // Configurar query para obtener solo hijos
    query.parentId = id;
    return this.categoryService.findAll(query);
  }

  // ==================== ENDPOINTS PROTEGIDOS ====================

  @Get(':id/products')
  @UseGuards(AuthGuard('jwt')) // 👈 ESPECIFICAR ESTRATEGIA
  async getCategoryProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: any,
  ) {
    // Verificar que la categoría existe
    await this.categoryService.findOne(id);

    // TODO: Implementar cuando tengamos el ProductController
    return {
      data: [],
      meta: {
        page: query.page || 1,
        limit: query.limit || 10,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      message: 'Integración con productos pendiente de implementar',
    };
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @UseInterceptors(new TransformInterceptor(CategoryResponseDto))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.create(createCategoryDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @UseInterceptors(new TransformInterceptor(CategoryResponseDto))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(new TransformInterceptor(CategoryResponseDto))
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: CategoryStatus,
    @GetUser() user: User,
    @Body('reason') reason?: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.updateStatus(id, status);
  }

  @Post('reorder')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderCategories(
    @Body() categoryOrders: { id: string; sortOrder: number }[],
  ): Promise<void> {
    return this.categoryService.reorderCategories(categoryOrders);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoryService.softDelete(id);
  }

  @Post(':id/restore')
  @UseGuards(AuthGuard('jwt')) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN)
  @UseInterceptors(new TransformInterceptor(CategoryResponseDto))
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.restore(id);
  }

  // ==================== ENDPOINTS DE VALIDACIÓN ====================

  @Get('slug/:slug/available')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async checkSlugAvailability(
    @Param('slug') slug: string,
    @Query('excludeId') excludeId?: string,
  ) {
    const isAvailable = await this.categoryService.isSlugAvailable(
      slug,
      excludeId,
    );

    return {
      slug,
      available: isAvailable,
      message: isAvailable ? 'Slug disponible' : 'Slug ya está en uso',
    };
  }

  @Post('validate-hierarchy')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 ESPECIFICAR ESTRATEGIA
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async validateHierarchy(
    @Body('categoryId') categoryId: string,
    @Body('newParentId') newParentId?: string,
  ) {
    // Validar que no se cree un ciclo
    if (newParentId) {
      const isDescendant = await this.categoryService['isDescendant'](
        categoryId,
        newParentId,
      );
      return {
        valid: !isDescendant,
        wouldCreateCycle: isDescendant,
        message: isDescendant
          ? 'Esta operación crearía un ciclo en la jerarquía'
          : 'Jerarquía válida',
      };
    }

    return { valid: true, message: 'Jerarquía válida' };
  }
}
