import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionService } from './services/subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';
import {
  SubscriptionCurrentDto,
  SubscriptionLimitsResponseDto,
  SubscriptionUsageDto,
  ActionValidationDto,
} from './dto/subscription-response.dto';

@ApiTags('Suscripciones')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ==================== ENDPOINTS PROTEGIDOS ====================

  /**
   * Obtener suscripción actual con todos los detalles
   * Usado para sincronización offline-first
   */
  @Get('current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener suscripción actual',
    description:
      'Retorna la suscripción activa con límites y características del plan. Si no existe, crea un trial automáticamente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Suscripción actual obtenida exitosamente',
    type: SubscriptionCurrentDto,
  })
  async getCurrentSubscription(
    @TenantId() organizationId: string,
  ): Promise<SubscriptionCurrentDto> {
    return this.subscriptionService.getCurrentSubscriptionDto(organizationId);
  }

  /**
   * Obtener límites del plan actual
   */
  @Get('limits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener límites del plan',
    description:
      'Retorna los límites de recursos y características habilitadas para el plan actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Límites del plan obtenidos exitosamente',
    type: SubscriptionLimitsResponseDto,
  })
  async getSubscriptionLimits(
    @TenantId() organizationId: string,
  ): Promise<SubscriptionLimitsResponseDto> {
    return this.subscriptionService.getSubscriptionLimits(organizationId);
  }

  /**
   * Obtener uso actual de recursos
   */
  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener uso actual de recursos',
    description:
      'Retorna el uso actual vs límites para cada recurso (productos, clientes, facturas, etc.).',
  })
  @ApiQuery({
    name: 'products',
    required: false,
    type: Number,
    description: 'Cantidad actual de productos',
  })
  @ApiQuery({
    name: 'customers',
    required: false,
    type: Number,
    description: 'Cantidad actual de clientes',
  })
  @ApiQuery({
    name: 'users',
    required: false,
    type: Number,
    description: 'Cantidad actual de usuarios',
  })
  @ApiQuery({
    name: 'invoicesThisMonth',
    required: false,
    type: Number,
    description: 'Cantidad de facturas este mes',
  })
  @ApiQuery({
    name: 'expensesThisMonth',
    required: false,
    type: Number,
    description: 'Cantidad de gastos este mes',
  })
  @ApiQuery({
    name: 'storageMB',
    required: false,
    type: Number,
    description: 'MB de almacenamiento usado',
  })
  @ApiResponse({
    status: 200,
    description: 'Uso de recursos obtenido exitosamente',
    type: SubscriptionUsageDto,
  })
  async getSubscriptionUsage(
    @TenantId() organizationId: string,
    @Query('products') products?: string,
    @Query('customers') customers?: string,
    @Query('users') users?: string,
    @Query('invoicesThisMonth') invoicesThisMonth?: string,
    @Query('expensesThisMonth') expensesThisMonth?: string,
    @Query('storageMB') storageMB?: string,
  ): Promise<SubscriptionUsageDto> {
    const usageCounts = {
      products: parseInt(products || '0', 10),
      customers: parseInt(customers || '0', 10),
      users: parseInt(users || '0', 10),
      invoicesThisMonth: parseInt(invoicesThisMonth || '0', 10),
      expensesThisMonth: parseInt(expensesThisMonth || '0', 10),
      storageMB: parseInt(storageMB || '0', 10),
    };

    return this.subscriptionService.getSubscriptionUsage(
      organizationId,
      usageCounts,
    );
  }

  /**
   * Validar si una acción está permitida
   */
  @Post('validate-action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar acción según el plan',
    description:
      'Valida si una acción específica está permitida según el plan y límites actuales.',
  })
  @ApiResponse({
    status: 200,
    description: 'Validación completada',
    type: ActionValidationDto,
  })
  async validateAction(
    @TenantId() organizationId: string,
    @Body() body: { action: string; currentUsage?: number },
  ): Promise<ActionValidationDto> {
    return this.subscriptionService.validateActionForPlan(
      organizationId,
      body.action,
      body.currentUsage,
    );
  }

  /**
   * Obtener información del plan (público)
   */
  @Get('info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener información de suscripción',
    description: 'Retorna información formateada de la suscripción actual.',
  })
  async getSubscriptionInfo(@TenantId() organizationId: string) {
    return this.subscriptionService.getSubscriptionInfo(organizationId);
  }

  /**
   * Obtener estadísticas de suscripciones (admin)
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener estadísticas de suscripciones',
    description: 'Retorna estadísticas globales de suscripciones (solo admin).',
  })
  async getSubscriptionStats() {
    return this.subscriptionService.getSubscriptionStats();
  }

  // ==================== ENDPOINT DE PRUEBA (DEBUG) ====================

  @Get('test/:organizationId')
  @ApiOperation({
    summary: 'Obtener información de suscripción (ENDPOINT DE PRUEBA)',
  })
  @ApiParam({ name: 'organizationId', description: 'ID de la organización' })
  async getSubscriptionTest(@Param('organizationId') organizationId: string) {
    try {
      // Obtener suscripción activa (puede ser null si está expirada)
      const activeSubscription =
        await this.subscriptionService.getActiveSubscription(organizationId);

      // Obtener todas las suscripciones de la organización
      const allSubscriptions =
        await this.subscriptionService.getOrganizationSubscriptions(
          organizationId,
        );

      // Probar capacidades
      const canCreateProduct = await this.subscriptionService.canPerformAction(
        organizationId,
        'create_product',
      );
      const canCreateUser = await this.subscriptionService.canPerformAction(
        organizationId,
        'create_user',
      );
      const userLimitCheck = await this.subscriptionService.checkUserLimit(
        organizationId,
        3,
      );
      const maxUsers =
        await this.subscriptionService.getMaxUsers(organizationId);

      return {
        organizationId,
        active_subscription: activeSubscription,
        all_subscriptions: allSubscriptions,
        permissions: {
          can_create_product: canCreateProduct,
          can_create_user: canCreateUser,
          user_limit_check_for_3_users: userLimitCheck,
          max_users: maxUsers,
        },
        subscription_analysis: {
          has_active_subscription: activeSubscription !== null,
          total_subscriptions: allSubscriptions.length,
          latest_subscription: allSubscriptions[0] || null,
        },
      };
    } catch (error) {
      return {
        error: error.message,
        organizationId,
      };
    }
  }
}
