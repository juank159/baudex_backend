import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Organization } from './entities/organization.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationStatsDto } from './dto/organization-response.dto';
import { SubscriptionService } from '../subscriptions/services/subscription.service';
import { SubscriptionType } from '../subscriptions/entities/subscription.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    const {
      name,
      slug,
      domain,
      logo,
      subscriptionPlan,
      currency,
      locale,
      timezone,
      settings,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
    } = createOrganizationDto;

    // Verificar que el slug no esté en uso
    const existingOrgBySlug = await this.organizationRepository.findOne({
      where: { slug },
    });

    if (existingOrgBySlug) {
      throw new ConflictException(`El slug '${slug}' ya está en uso`);
    }

    // Verificar que el dominio no esté en uso (si se proporciona)
    if (domain) {
      const existingOrgByDomain = await this.organizationRepository.findOne({
        where: { domain },
      });

      if (existingOrgByDomain) {
        throw new ConflictException(`El dominio '${domain}' ya está en uso`);
      }
    }

    // Verificar que el email del administrador no esté en uso
    const existingUser = await this.userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingUser) {
      throw new ConflictException(`El email '${adminEmail}' ya está en uso`);
    }

    // Usar transacción para crear organización y usuario administrador
    return this.organizationRepository.manager.transaction(async (manager) => {
      // Crear organización
      const organization = manager.create(Organization, {
        name,
        slug,
        domain,
        logo,
        subscriptionPlan,
        currency: currency || 'USD',
        locale: locale || 'en',
        timezone: timezone || 'America/New_York',
        settings: settings || {},
        isActive: true,
      });

      const savedOrganization = await manager.save(organization);

      // Crear suscripción trial automáticamente usando el nuevo servicio
      await this.subscriptionService.createTrialSubscription(
        savedOrganization.id,
      );

      // Crear usuario administrador
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const adminUser = manager.create(User, {
        email: adminEmail,
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        organizationId: savedOrganization.id,
      });

      await manager.save(adminUser);

      return savedOrganization;
    });
  }

  async findAll(): Promise<Organization[]> {
    return this.organizationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({
      where: { slug, isActive: true },
    });
  }

  async findById(id: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id },
      relations: ['subscriptions'],
    });

    if (!organization) {
      throw new NotFoundException(`Organización con ID ${id} no encontrada`);
    }

    return organization;
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const organization = await this.findById(id);

    // Verificar dominio único (si se está cambiando)
    if (
      updateOrganizationDto.domain &&
      updateOrganizationDto.domain !== organization.domain
    ) {
      const existingOrgByDomain = await this.organizationRepository.findOne({
        where: { domain: updateOrganizationDto.domain },
      });

      if (existingOrgByDomain && existingOrgByDomain.id !== id) {
        throw new ConflictException(
          `El dominio '${updateOrganizationDto.domain}' ya está en uso`,
        );
      }
    }

    Object.assign(organization, updateOrganizationDto);
    return this.organizationRepository.save(organization);
  }

  async activate(id: string): Promise<Organization> {
    const organization = await this.findById(id);
    organization.isActive = true;
    return this.organizationRepository.save(organization);
  }

  async deactivate(id: string): Promise<Organization> {
    const organization = await this.findById(id);

    // No permitir desactivar la organización por defecto
    if (organization.slug === 'default') {
      throw new BadRequestException(
        'No se puede desactivar la organización por defecto',
      );
    }

    organization.isActive = false;
    return this.organizationRepository.save(organization);
  }

  async getStats(organizationId: string): Promise<OrganizationStatsDto> {
    // Obtener estadísticas básicas
    const [totalUsers, totalProducts, totalCustomers, totalInvoices] =
      await Promise.all([
        this.userRepository.count({ where: { organizationId } }),
        // Note: Estas queries fallarán hasta que agreguemos organizationId a todas las entidades
        // Por ahora retornamos 0 para evitar errores
        Promise.resolve(0), // this.productRepository.count({ where: { organizationId } }),
        Promise.resolve(0), // this.customerRepository.count({ where: { organizationId } }),
        Promise.resolve(0), // this.invoiceRepository.count({ where: { organizationId } }),
      ]);

    // Calcular ingresos totales y del mes actual
    const totalRevenue = 0; // Implementar cuando tengamos las entidades actualizadas
    const currentMonthInvoices = 0;
    const currentMonthRevenue = 0;

    return {
      totalUsers,
      totalProducts,
      totalCustomers,
      totalInvoices,
      totalRevenue,
      currentMonthInvoices,
      currentMonthRevenue,
    };
  }

  async remove(id: string): Promise<void> {
    const organization = await this.findById(id);

    // No permitir eliminar la organización por defecto
    if (organization.slug === 'default') {
      throw new BadRequestException(
        'No se puede eliminar la organización por defecto',
      );
    }

    // Verificar que no tenga usuarios activos (excepto el administrador que se puede transferir)
    const userCount = await this.userRepository.count({
      where: { organizationId: id },
    });

    if (userCount > 1) {
      throw new BadRequestException(
        'No se puede eliminar una organización con múltiples usuarios. ' +
          'Transfiera los usuarios a otra organización primero.',
      );
    }

    // Soft delete
    await this.organizationRepository.softDelete(id);
  }

  // Método para validar límites del plan (ahora usando SubscriptionService)
  async validatePlanLimits(
    organizationId: string,
    feature: string,
    currentCount?: number,
  ): Promise<boolean> {
    // Para features de usuarios, usar el nuevo sistema
    if (feature === 'maxUsers' && currentCount !== undefined) {
      return this.subscriptionService.checkUserLimit(
        organizationId,
        currentCount,
      );
    }

    // Para otras features, usar validación genérica
    return this.subscriptionService.canPerformAction(organizationId, feature);
  }

  // Método para obtener información de suscripción (ahora usando SubscriptionService)
  async getSubscriptionInfo(organizationId: string) {
    // Verificar que la organización existe
    await this.findById(organizationId);

    // Usar el nuevo SubscriptionService
    return this.subscriptionService.getSubscriptionInfo(organizationId);
  }

  // Método para actualizar suscripción (ahora usando SubscriptionService)
  async updateSubscription(
    organizationId: string,
    plan: string,
    endDate: Date,
  ): Promise<Organization> {
    // Verificar que la organización existe
    const organization = await this.findById(organizationId);

    // Usar el nuevo SubscriptionService para crear una suscripción pagada
    const planEnum = plan as any; // Convertir string a enum
    const durationMonths = Math.ceil(
      (endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30),
    );

    await this.subscriptionService.createPaidSubscription(
      organizationId,
      planEnum,
      SubscriptionType.MONTHLY, // tipo por defecto
      0, // precio por defecto
      'USD', // moneda por defecto
      durationMonths,
    );

    return organization;
  }

  // Método para búsqueda de organizaciones
  async search(query: string): Promise<Organization[]> {
    return this.organizationRepository
      .createQueryBuilder('organization')
      .where(
        'organization.name ILIKE :query OR organization.slug ILIKE :query OR organization.domain ILIKE :query',
        { query: `%${query}%` },
      )
      .andWhere('organization.isActive = :isActive', { isActive: true })
      .orderBy('organization.name', 'ASC')
      .limit(10)
      .getMany();
  }

  // ✅ NUEVO: Método para actualizar margen de ganancia de productos temporales
  async updateProfitMargin(
    organizationId: string,
    marginPercentage: number,
  ): Promise<{ marginPercentage: number }> {
    const organization = await this.findById(organizationId);

    // Actualizar settings con el nuevo margen de ganancia
    const currentSettings = organization.settings || {};
    const updatedSettings = {
      ...currentSettings,
      defaultProfitMarginPercentage: marginPercentage,
    };

    await this.organizationRepository.update(organizationId, {
      settings: updatedSettings as Record<string, any>,
    });

    console.log(
      `📊 Margen de ganancia actualizado para organización ${organization.name}: ${marginPercentage}%`,
    );

    return { marginPercentage };
  }
}
