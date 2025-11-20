import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';
import { SeedService } from '../common/services/seed.service';
import { SubscriptionService } from '../subscriptions/services/subscription.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly jwtService: JwtService,
    private readonly seedService: SeedService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async register(
    registerDto: RegisterDto,
    organizationId?: string,
  ): Promise<AuthResponse> {
    const {
      email,
      password,
      firstName,
      lastName,
      role = UserRole.USER,
      organizationName,
    } = registerDto;

    let targetOrganizationId = organizationId;
    let organization;

    // MULTITENANT: Lógica para crear/obtener organización
    if (organizationName) {
      // SIEMPRE crear una nueva organización única para cada usuario, incluso con organizationName
      const baseSlug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15); // Reducir a 15 para dejar espacio al sufijo único

      // Generar ID temporal para crear nombres únicos
      const tempId = this.generateUniqueId();
      const uniqueSuffix = tempId.slice(-8); // Últimos 8 caracteres del ID

      // Generar slug y nombre únicos
      const uniqueSlug = `${baseSlug}-${uniqueSuffix}`;
      const uniqueName = `${organizationName} ${uniqueSuffix}`;

      // Crear nueva organización única
      organization = this.organizationRepository.create({
        name: uniqueName,
        slug: uniqueSlug,
        isActive: true,
      });

      organization = await this.organizationRepository.save(organization);
      console.log(
        `🏢 Nueva organización única creada: ${uniqueName} (${uniqueSlug})`,
      );

      targetOrganizationId = organization.id;
    } else if (!targetOrganizationId) {
      // SIEMPRE crear una nueva organización única para cada usuario
      const emailDomain = email.split('@')[1];
      const domainSlug = emailDomain
        .split('.')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);

      // Generar ID temporal para crear nombres únicos
      const tempId = this.generateUniqueId();
      const uniqueSuffix = tempId.slice(-8); // Últimos 8 caracteres del ID

      // Generar nombre único basado en dominio + sufijo único
      const domainBase = emailDomain.split('.')[0];
      const uniqueName = `${domainBase.charAt(0).toUpperCase() + domainBase.slice(1)} ${uniqueSuffix}`;
      const uniqueSlug = `${domainSlug}-${uniqueSuffix}`;

      organization = this.organizationRepository.create({
        name: uniqueName,
        slug: uniqueSlug,
        isActive: true,
      });

      organization = await this.organizationRepository.save(organization);
      console.log(
        `🏢 Nueva organización única creada: ${organization.name} (${uniqueSlug})`,
      );

      targetOrganizationId = organization.id;
    } else {
      // Verificar que la organización existe y está activa
      organization = await this.organizationRepository.findOne({
        where: { id: targetOrganizationId, isActive: true },
      });

      if (!organization) {
        throw new BadRequestException(
          'La organización especificada no existe o está inactiva',
        );
      }
    }

    // Verificar si el usuario ya existe en la misma organización
    const existingUser = await this.userRepository.findOne({
      where: {
        email,
        organizationId: targetOrganizationId,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'El usuario ya existe con este email en esta organización',
      );
    }

    // Crear usuario (el password se encripta automáticamente en @BeforeInsert)
    const user = this.userRepository.create({
      email,
      password, // Se encriptará automáticamente
      firstName,
      lastName,
      role,
      status: UserStatus.ACTIVE,
      organizationId: targetOrganizationId,
    });

    await this.userRepository.save(user);

    // SEED: Crear datos de muestra para la nueva organización
    try {
      await this.seedService.createSampleDataForOrganization(
        targetOrganizationId,
        user,
      );
      console.log(`🌱 Datos de muestra creados para usuario: ${user.email}`);
    } catch (seedError) {
      console.error(
        `❌ Error creando datos de muestra para ${user.email}:`,
        seedError,
      );
      // No fallar el registro si hay error en el seed, solo loguearlo
    }

    // SUBSCRIPTION: Crear suscripción trial automáticamente para la nueva organización
    try {
      await this.subscriptionService.createTrialSubscription(
        targetOrganizationId,
      );
      console.log(
        `💳 Suscripción trial creada para organización: ${organization.name}`,
      );
    } catch (subscriptionError) {
      console.error(
        `❌ Error creando suscripción trial para ${organization.name}:`,
        subscriptionError,
      );
      // No fallar el registro si hay error en la suscripción, solo loguearlo
    }

    // Generar token
    const token = this.getJwtToken({ id: user.id });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        organizationId: user.organizationId,
        organizationSlug: organization.slug,
        organizationName: organization.name,
      },
    };
  }

  async login(
    loginDto: LoginDto,
    organizationId?: string,
  ): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Construir las condiciones de búsqueda
    const whereCondition: any = {
      email,
      status: UserStatus.ACTIVE,
    };

    // Si se especifica organizationId, agregarlo a la búsqueda
    if (organizationId) {
      whereCondition.organizationId = organizationId;
    }

    // Buscar usuario activo
    const user = await this.userRepository.findOne({
      where: whereCondition,
      select: [
        'id',
        'email',
        'password',
        'firstName',
        'lastName',
        'role',
        'status',
        'organizationId',
      ],
      relations: ['organization'],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que la organización del usuario esté activa
    if (user.organization && !user.organization.isActive) {
      throw new UnauthorizedException('La organización está inactiva');
    }

    // Verificar contraseña usando el método de la entidad
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Actualizar último login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generar token
    const token = this.getJwtToken({ id: user.id });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        organizationId: user.organizationId,
        organizationSlug: user.organization.slug,
        organizationName: user.organization.name,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<User> {
    const { id } = payload;

    const user = await this.userRepository.findOne({
      where: {
        id,
        status: UserStatus.ACTIVE,
      },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'status',
        'organizationId',
        'lastLoginAt',
        'avatar',
        'phone',
      ],
      relations: ['organization'],
    });

    if (!user) {
      console.error('❌ AuthService.validateUser: User not found', {
        userId: id,
      });
      throw new UnauthorizedException('Token inválido');
    }

    // Verificar que el usuario tenga un rol asignado
    if (!user.role) {
      console.error('❌ AuthService.validateUser: User has no role', {
        userId: user.id,
        email: user.email,
      });
      throw new UnauthorizedException('Usuario sin rol asignado');
    }

    // Verificar que tenga una organización asignada
    if (!user.organizationId) {
      console.error('❌ AuthService.validateUser: User has no organization', {
        userId: user.id,
        email: user.email,
      });
      throw new UnauthorizedException('Usuario sin organización asignada');
    }

    // Verificar que la organización del usuario esté activa
    if (user.organization && !user.organization.isActive) {
      console.error('❌ AuthService.validateUser: Organization is inactive', {
        userId: user.id,
        organizationId: user.organizationId,
        organizationSlug: user.organization.slug,
      });
      throw new UnauthorizedException('La organización está inactiva');
    }

    // Si no se encontró la organización en la relación, buscarla
    if (!user.organization) {
      const organization = await this.organizationRepository.findOne({
        where: { id: user.organizationId, isActive: true },
      });

      if (!organization) {
        console.error(
          '❌ AuthService.validateUser: Organization not found or inactive',
          {
            userId: user.id,
            organizationId: user.organizationId,
          },
        );
        throw new UnauthorizedException(
          'Organización no encontrada o inactiva',
        );
      }

      user.organization = organization;
    }

    console.log('✅ AuthService.validateUser: User validated successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return user;
  }

  public getJwtToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  async refreshToken(user: User): Promise<{ token: string }> {
    const token = this.getJwtToken({ id: user.id });
    return { token };
  }

  /**
   * ✅ NUEVO: Validar contraseña del usuario para operaciones sensibles
   */
  async validatePassword(userId: string, password: string): Promise<{ valid: boolean; message: string }> {
    // Validar que se proporcione la contraseña
    if (!password || password.trim() === '') {
      throw new BadRequestException('La contraseña es requerida');
    }

    // Buscar el usuario por ID
    const user = await this.userRepository.findOne({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: ['id', 'email', 'password'] // Incluir password para la validación
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Verificar la contraseña usando bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log(`🔒 Intento de validación de contraseña fallido para usuario ${user.email}`);
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    console.log(`✅ Contraseña validada exitosamente para usuario ${user.email}`);
    
    return {
      valid: true,
      message: 'Contraseña válida'
    };
  }

  /**
   * Genera un ID único para usar en nombres de organizaciones
   */
  private generateUniqueId(): string {
    return randomUUID();
  }
}
