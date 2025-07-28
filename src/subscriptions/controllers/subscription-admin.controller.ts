// src/subscriptions/controllers/subscription-admin.controller.ts
import { Controller, Post, Get, UseGuards, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { SubscriptionExpirationService } from '../services/subscription-expiration.service';
import { SubscriptionRenewalService } from '../services/subscription-renewal.service';
import { RenewSubscriptionDto, RenewSubscriptionResponseDto } from '../dto/renew-subscription.dto';

@ApiTags('Subscription Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN) // Solo super admins
@Controller('admin/subscriptions')
export class SubscriptionAdminController {
  constructor(
    private readonly subscriptionExpirationService: SubscriptionExpirationService,
    private readonly subscriptionRenewalService: SubscriptionRenewalService,
  ) {}

  @Post('force-expire')
  @ApiOperation({ summary: 'Forzar expiración manual de suscripciones vencidas' })
  @ApiResponse({
    status: 200,
    description: 'Suscripciones expiradas actualizadas',
    schema: {
      type: 'object',
      properties: {
        affected: { type: 'number', description: 'Número de suscripciones afectadas' },
        subscriptions: {
          type: 'array',
          description: 'Lista de suscripciones que fueron expiradas'
        }
      }
    }
  })
  async forceExpireSubscriptions() {
    const result = await this.subscriptionExpirationService.forceExpireSubscriptions();
    
    return {
      success: true,
      message: `${result.affected} suscripciones actualizadas a estado EXPIRED`,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de suscripciones' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de suscripciones',
  })
  async getSubscriptionStats() {
    const stats = await this.subscriptionExpirationService.getSubscriptionStats();
    
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('check-trials')
  @ApiOperation({ summary: 'Verificar trials que vencen pronto' })
  @ApiResponse({
    status: 200,
    description: 'Verificación de trials completada',
  })
  async checkExpiringTrials() {
    await this.subscriptionExpirationService.handleTrialWarnings();
    
    return {
      success: true,
      message: 'Verificación de trials completada - revisar logs para detalles',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('renew')
  @ApiOperation({ summary: 'Renovar suscripción de una organización' })
  @ApiResponse({
    status: 200,
    description: 'Suscripción renovada exitosamente',
    type: RenewSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Organización no encontrada',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  async renewSubscription(@Body() renewData: RenewSubscriptionDto): Promise<RenewSubscriptionResponseDto> {
    const result = await this.subscriptionRenewalService.renewSubscription(renewData);
    
    return {
      success: true,
      message: `Suscripción renovada exitosamente. Plan ${result.plan} por ${result.durationMonths} mes(es)`,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('organization/:organizationId/details')
  @ApiOperation({ summary: 'Obtener detalles de suscripciones de una organización' })
  @ApiParam({
    name: 'organizationId',
    description: 'ID de la organización',
    example: 'c99d0fd8-667b-4b8b-a52b-10380fbbf611',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalles de suscripciones obtenidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Organización no encontrada',
  })
  async getOrganizationSubscriptionDetails(
    @Param('organizationId', ParseUUIDPipe) organizationId: string
  ) {
    const details = await this.subscriptionRenewalService.getOrganizationSubscriptionDetails(organizationId);
    
    return {
      success: true,
      data: details,
      timestamp: new Date().toISOString(),
    };
  }
}