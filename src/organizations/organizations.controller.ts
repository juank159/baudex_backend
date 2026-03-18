import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Put,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  OrganizationResponseDto,
  OrganizationStatsDto,
} from './dto/organization-response.dto';
import { Organization } from './entities/organization.entity';
import { SubscriptionService } from '../subscriptions/services/subscription.service';

@ApiTags('Organizaciones')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN) // Solo super admins pueden crear organizaciones
  @ApiOperation({ summary: 'Crear nueva organización' })
  @ApiResponse({
    status: 201,
    description: 'Organización creada exitosamente',
    type: OrganizationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 409, description: 'Slug o dominio ya en uso' })
  async create(
    @Body() createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.create(
      createOrganizationDto,
    );
    return await this.transformToResponseDto(organization);
  }

  @Get()
  @Roles(UserRole.ADMIN) // Solo super admins pueden ver todas las organizaciones
  @ApiOperation({ summary: 'Obtener todas las organizaciones' })
  @ApiResponse({
    status: 200,
    description: 'Lista de organizaciones',
    type: [OrganizationResponseDto],
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Búsqueda por nombre, slug o dominio',
  })
  async findAll(
    @Query('search') search?: string,
  ): Promise<OrganizationResponseDto[]> {
    let organizations: Organization[];

    if (search) {
      organizations = await this.organizationsService.search(search);
    } else {
      organizations = await this.organizationsService.findAll();
    }

    return await Promise.all(
      organizations.map((org) => this.transformToResponseDto(org)),
    );
  }

  @Get('current')
  @ApiOperation({ summary: 'Obtener información de la organización actual' })
  @ApiResponse({
    status: 200,
    description: 'Información de la organización actual',
    type: OrganizationResponseDto,
  })
  async getCurrentOrganization(
    @GetUser() user: User,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.findById(
      user.organizationId,
    );
    return await this.transformToResponseDto(organization);
  }

  @Get('current/stats')
  @ApiOperation({ summary: 'Obtener estadísticas de la organización actual' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de la organización',
    type: OrganizationStatsDto,
  })
  async getCurrentOrganizationStats(
    @GetUser() user: User,
  ): Promise<OrganizationStatsDto> {
    return this.organizationsService.getStats(user.organizationId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN) // Solo super admins pueden ver cualquier organización
  @ApiOperation({ summary: 'Obtener organización por ID' })
  @ApiParam({ name: 'id', description: 'ID de la organización' })
  @ApiResponse({
    status: 200,
    description: 'Información de la organización',
    type: OrganizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Organización no encontrada' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.findById(id);
    return await this.transformToResponseDto(organization);
  }

  @Get(':id/stats')
  @Roles(UserRole.ADMIN) // Solo super admins pueden ver estadísticas de cualquier organización
  @ApiOperation({ summary: 'Obtener estadísticas de una organización' })
  @ApiParam({ name: 'id', description: 'ID de la organización' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de la organización',
    type: OrganizationStatsDto,
  })
  async getOrganizationStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationStatsDto> {
    return this.organizationsService.getStats(id);
  }

  @Patch('current')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER) // Todos los usuarios pueden actualizar su organización
  @ApiOperation({ summary: 'Actualizar organización actual' })
  @ApiResponse({
    status: 200,
    description: 'Organización actualizada exitosamente',
    type: OrganizationResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Dominio ya en uso' })
  async updateCurrent(
    @GetUser() user: User,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.update(
      user.organizationId,
      updateOrganizationDto,
    );
    return await this.transformToResponseDto(organization);
  }

  @Put('current/profit-margin')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER) // Cualquier usuario puede configurar su margen
  @ApiOperation({ 
    summary: 'Configurar margen de ganancia para productos temporales',
    description: 'Establece el porcentaje de ganancia usado para calcular costos estimados de productos temporales'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        marginPercentage: {
          type: 'number',
          minimum: 5,
          maximum: 50,
          description: 'Porcentaje de margen de ganancia (5% - 50%)',
          example: 20
        }
      },
      required: ['marginPercentage']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Margen de ganancia actualizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        marginPercentage: { type: 'number', example: 20 },
        message: { type: 'string', example: 'Margen de ganancia actualizado exitosamente' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Porcentaje inválido (debe estar entre 5% y 50%)' })
  async updateProfitMargin(
    @GetUser() user: User,
    @Body() body: { marginPercentage: number },
  ): Promise<{ success: boolean; marginPercentage: number; message: string }> {
    const { marginPercentage } = body;

    // Validar rango
    if (marginPercentage < 5 || marginPercentage > 50) {
      throw new BadRequestException(
        'El margen de ganancia debe estar entre 5% y 50%'
      );
    }

    const result = await this.organizationsService.updateProfitMargin(
      user.organizationId,
      marginPercentage,
    );

    return {
      success: true,
      marginPercentage: result.marginPercentage,
      message: 'Margen de ganancia actualizado exitosamente',
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN) // Solo super admins pueden actualizar cualquier organización
  @ApiOperation({ summary: 'Actualizar organización por ID' })
  @ApiParam({ name: 'id', description: 'ID de la organización' })
  @ApiResponse({
    status: 200,
    description: 'Organización actualizada exitosamente',
    type: OrganizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Organización no encontrada' })
  @ApiResponse({ status: 409, description: 'Dominio ya en uso' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.update(
      id,
      updateOrganizationDto,
    );
    return await this.transformToResponseDto(organization);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN) // Solo super admins
  @ApiOperation({ summary: 'Activar organización' })
  @ApiParam({ name: 'id', description: 'ID de la organización' })
  @ApiResponse({
    status: 200,
    description: 'Organización activada exitosamente',
    type: OrganizationResponseDto,
  })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.activate(id);
    return await this.transformToResponseDto(organization);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN) // Solo super admins
  @ApiOperation({ summary: 'Desactivar organización' })
  @ApiParam({ name: 'id', description: 'ID de la organización' })
  @ApiResponse({
    status: 200,
    description: 'Organización desactivada exitosamente',
    type: OrganizationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede desactivar la organización por defecto',
  })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.deactivate(id);
    return await this.transformToResponseDto(organization);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN) // Solo super admins
  @ApiOperation({ summary: 'Eliminar organización' })
  @ApiParam({ name: 'id', description: 'ID de la organización' })
  @ApiResponse({
    status: 204,
    description: 'Organización eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Organización no encontrada' })
  @ApiResponse({
    status: 400,
    description:
      'No se puede eliminar la organización por defecto o con usuarios activos',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.organizationsService.remove(id);
  }

  // ==================== ENDPOINTS DE SUSCRIPCIÓN ====================

  @Get('current/subscription')
  @ApiOperation({ summary: 'Obtener información de suscripción actual' })
  @ApiResponse({
    status: 200,
    description: 'Información de suscripción de la organización',
  })
  async getCurrentSubscriptionInfo(@GetUser() user: User) {
    return this.organizationsService.getSubscriptionInfo(user.organizationId);
  }

  @Post('current/subscription/renew')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Renovar suscripción de la organización actual' })
  @ApiResponse({
    status: 200,
    description: 'Suscripción renovada exitosamente',
    type: OrganizationResponseDto,
  })
  async renewCurrentSubscription(
    @GetUser() user: User,
    @Body() body: { plan: string; durationMonths: number },
  ): Promise<OrganizationResponseDto> {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + body.durationMonths);

    const organization = await this.organizationsService.updateSubscription(
      user.organizationId,
      body.plan,
      endDate,
    );
    return await this.transformToResponseDto(organization);
  }

  // Método helper para transformar la entidad a DTO
  private async transformToResponseDto(
    organization: Organization,
  ): Promise<OrganizationResponseDto> {
    // Obtener información de suscripción usando el nuevo servicio
    let subscriptionInfo;
    try {
      subscriptionInfo = await this.subscriptionService.getSubscriptionInfo(
        organization.id,
      );
    } catch (error) {
      console.warn(
        `No se pudo obtener información de suscripción para organización ${organization.id}:`,
        error.message,
      );
      subscriptionInfo = null;
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      domain: organization.domain,
      logo: organization.logo,
      isActive: organization.isActive,
      currency: organization.currency,
      locale: organization.locale,
      timezone: organization.timezone,
      settings: organization.settings,
      multiCurrencyEnabled: organization.multiCurrencyEnabled ?? false,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
      displayName: organization.displayName,

      // Información de suscripción nueva
      subscription: subscriptionInfo,

      // Campos legacy para compatibilidad (deprecados)
      subscriptionPlan: subscriptionInfo?.plan || organization.subscriptionPlan,
      isActivePlan: subscriptionInfo?.isActive ?? organization.isActive,
      subscriptionStatus:
        subscriptionInfo?.status || organization.subscriptionStatus,
      hasValidSubscription: subscriptionInfo?.isActive ?? false,
      isTrialExpired: subscriptionInfo?.isExpired ?? true,
      daysUntilExpiration: subscriptionInfo?.daysUntilExpiration ?? 30,
      trialStartDate:
        subscriptionInfo?.startDate ||
        organization.trialStartDate?.toISOString(),
      trialEndDate:
        subscriptionInfo?.trialEndsAt ||
        organization.trialEndDate?.toISOString(),
      subscriptionStartDate:
        subscriptionInfo?.startDate ||
        organization.subscriptionStartDate?.toISOString(),
      subscriptionEndDate:
        subscriptionInfo?.endDate ||
        organization.subscriptionEndDate?.toISOString(),
    };
  }
}
