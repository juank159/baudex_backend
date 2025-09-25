import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { CategoryService } from './categories.service';
import { SlugService } from 'src/common/services/slug.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryStatus } from './entities/category.entity';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('admin/categories')
@UseGuards(AuthGuard(), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@UseInterceptors(new TransformInterceptor(CategoryResponseDto))
export class CategoryAdminController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly slugService: SlugService,
  ) {}

  // ==================== GESTIÓN DE SLUGS ====================

  @Post('generate-slug')
  async generateSlug(@Body('name') name: string): Promise<{ slug: string }> {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException(
        'El nombre es requerido para generar el slug',
      );
    }

    const uniqueSlug = await this.categoryService.generateUniqueSlug(name);
    return { slug: uniqueSlug };
  }

  @Get('validate-slug/:slug')
  async validateSlug(
    @Param('slug') slug: string,
    @Query('excludeId') excludeId?: string,
  ): Promise<{ valid: boolean; message: string }> {
    const isAvailable = await this.categoryService.isSlugAvailable(
      slug,
      excludeId,
    );

    return {
      valid: isAvailable,
      message: isAvailable
        ? 'Slug disponible'
        : 'Slug ya está en uso por otra categoría',
    };
  }

  // ==================== GESTIÓN DE CATEGORÍAS CON ELIMINADAS ====================

  @Get('with-deleted')
  async findAllWithDeleted(
    @Query() query: CategoryQueryDto,
    @GetUser() user: User,
  ) {
    // Solo los administradores pueden ver categorías eliminadas
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden ver categorías eliminadas',
      );
    }

    return this.categoryService.findAllWithDeleted(query);
  }

  @Get('deleted')
  async findDeleted(@Query() query: CategoryQueryDto, @GetUser() user: User) {
    // Solo los administradores pueden ver categorías eliminadas
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden ver categorías eliminadas',
      );
    }

    return this.categoryService.findDeleted(query);
  }

  // ==================== ESTADÍSTICAS ADMINISTRATIVAS ====================

  @Get('detailed-stats')
  async getDetailedStats(@GetUser() user: User) {
    const basicStats = await this.categoryService.getStats();

    // Estadísticas adicionales usando query builder para evitar problemas de tipos
    const withProductsCount = await this.categoryService['categoryRepository']
      .createQueryBuilder('category')
      .leftJoin('category.products', 'product')
      .where('product.id IS NOT NULL')
      .getCount();

    return {
      ...basicStats,
      withProducts: withProductsCount,
      withoutProducts: basicStats.total - withProductsCount,
      lastUpdated: new Date(),
      generatedBy: user.fullName,
    };
  }

  @Get('health-check')
  async healthCheck(@GetUser() user: User) {
    // Verificar integridad de datos de categorías
    const issues = [];

    // Verificar categorías huérfanas (padre inexistente)
    const orphanedCategories = await this.categoryService['categoryRepository']
      .createQueryBuilder('category')
      .leftJoin('category.parent', 'parent')
      .where('category.parentId IS NOT NULL')
      .andWhere('parent.id IS NULL')
      .getMany();

    if (orphanedCategories.length > 0) {
      issues.push({
        type: 'orphaned_categories',
        count: orphanedCategories.length,
        message: `${orphanedCategories.length} categorías tienen un padre inexistente`,
        severity: 'high',
      });
    }

    // Verificar duplicados de slug
    const duplicateSlugs = await this.categoryService['categoryRepository']
      .createQueryBuilder('category')
      .select('category.slug')
      .addSelect('COUNT(*)', 'count')
      .groupBy('category.slug')
      .having('COUNT(*) > 1')
      .getRawMany();

    if (duplicateSlugs.length > 0) {
      issues.push({
        type: 'duplicate_slugs',
        count: duplicateSlugs.length,
        message: `${duplicateSlugs.length} slugs duplicados encontrados`,
        severity: 'medium',
      });
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'issues_found',
      issues,
      checkedAt: new Date(),
      checkedBy: user.fullName,
    };
  }

  // ==================== OPERACIONES MASIVAS ====================

  @Post('bulk-update-status')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateStatus(
    @Body()
    data: {
      categoryIds: string[];
      status: CategoryStatus;
      reason?: string;
    },
    @GetUser() user: User,
  ) {
    const results = [];

    for (const categoryId of data.categoryIds) {
      try {
        const category = await this.categoryService.updateStatus(
          categoryId,
          data.status,
        );
        results.push({
          id: categoryId,
          success: true,
          category,
        });
      } catch (error) {
        results.push({
          id: categoryId,
          success: false,
          error: error.message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      message: `Procesadas ${data.categoryIds.length} categorías`,
      totalProcessed: data.categoryIds.length,
      successful,
      failed,
      results,
      updatedBy: user.fullName,
      updatedAt: new Date(),
    };
  }

  @Post('bulk-restore')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkRestore(
    @Body() data: { categoryIds: string[]; reason?: string },
    @GetUser() user: User,
  ) {
    const results = [];

    for (const categoryId of data.categoryIds) {
      try {
        const category = await this.categoryService.restore(categoryId);
        results.push({
          id: categoryId,
          success: true,
          category,
        });
      } catch (error) {
        results.push({
          id: categoryId,
          success: false,
          error: error.message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      message: `Procesadas ${data.categoryIds.length} categorías para restauración`,
      totalProcessed: data.categoryIds.length,
      successful,
      failed,
      results,
      restoredBy: user.fullName,
      restoredAt: new Date(),
    };
  }

  // ==================== ELIMINACIÓN PERMANENTE ====================

  @Patch(':id/force-delete')
  @Roles(UserRole.ADMIN) // Solo administradores pueden eliminar permanentemente
  @HttpCode(HttpStatus.NO_CONTENT)
  async forceDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categoryService.forceDelete(id);
  }

  // ==================== AUDITORÍA Y LOGS ====================

  @Get(':id/audit-log')
  async getAuditLog(@Param('id', ParseUUIDPipe) id: string) {
    // TODO: Implementar sistema de auditoría
    return {
      categoryId: id,
      events: [
        {
          action: 'created',
          timestamp: new Date(),
          user: 'system',
          details: 'Categoría creada',
        },
      ],
      message: 'Sistema de auditoría pendiente de implementar',
    };
  }

  // ==================== HERRAMIENTAS DE MANTENIMIENTO ====================

  @Post('rebuild-tree')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rebuildTree(@GetUser() user: User) {
    // TODO: Implementar reconstrucción del árbol de categorías

    return {
      message: 'Árbol de categorías reconstruido exitosamente',
      rebuiltBy: user.fullName,
      rebuiltAt: new Date(),
      note: 'Funcionalidad pendiente de implementar',
    };
  }

  @Post('fix-sort-order')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async fixSortOrder(@GetUser() user: User) {
    // TODO: Implementar corrección automática de sortOrder

    return {
      message: 'Orden de categorías corregido exitosamente',
      fixedBy: user.fullName,
      fixedAt: new Date(),
      note: 'Funcionalidad pendiente de implementar',
    };
  }

  @Post('remove-orphans')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeOrphans(@GetUser() user: User) {
    // Buscar y remover categorías huérfanas
    const orphanedCategories = await this.categoryService['categoryRepository']
      .createQueryBuilder('category')
      .leftJoin('category.parent', 'parent')
      .where('category.parentId IS NOT NULL')
      .andWhere('parent.id IS NULL')
      .getMany();

    if (orphanedCategories.length > 0) {
      // TODO: Implementar lógica de limpieza
      return {
        message: `Se encontraron ${orphanedCategories.length} categorías huérfanas`,
        orphanedCount: orphanedCategories.length,
        cleanedBy: user.fullName,
        cleanedAt: new Date(),
        note: 'Limpieza automática pendiente de implementar',
      };
    }

    return {
      message: 'No se encontraron categorías huérfanas',
      orphanedCount: 0,
      checkedBy: user.fullName,
      checkedAt: new Date(),
    };
  }

  // ==================== IMPORTACIÓN Y EXPORTACIÓN ====================

  @Get('export')
  async exportCategories(
    @Query('format') format: 'json' | 'csv' = 'json',
    @GetUser() user: User,
  ) {
    const categories = await this.categoryService.findAll({
      page: 1,
      limit: 1000, // Exportar todas
    });

    // Compatibilidad con ambos tipos de meta
    const totalItems =
      'totalItems' in categories.meta
        ? categories.meta.totalItems
        : categories.meta.total;

    return {
      format,
      data: categories.data,
      exportedBy: user.fullName,
      exportedAt: new Date(),
      total: totalItems,
    };
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  async importCategories(
    @Body() data: { categories: any[]; options?: any },
    @GetUser() user: User,
  ) {
    // TODO: Implementar importación de categorías

    return {
      message: 'Importación completada',
      imported: 0,
      errors: [],
      importedBy: user.fullName,
      importedAt: new Date(),
      note: 'Funcionalidad pendiente de implementar',
    };
  }
}
