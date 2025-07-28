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

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';
import { SeedService } from '../common/services/seed.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly jwtService: JwtService,
    private readonly seedService: SeedService,
  ) {}

  async register(registerDto: RegisterDto, organizationId?: string): Promise<AuthResponse> {
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
      // Generar slug a partir del nombre de la organización
      const slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
      
      // Buscar si ya existe una organización con este slug
      organization = await this.organizationRepository.findOne({
        where: { slug, isActive: true },
      });
      
      if (!organization) {
        // Crear nueva organización
        organization = this.organizationRepository.create({
          name: organizationName,
          slug,
          isActive: true,
        });
        
        organization = await this.organizationRepository.save(organization);
        console.log(`🏢 Nueva organización creada: ${organizationName} (${slug})`);
      }
      
      targetOrganizationId = organization.id;
    } else if (!targetOrganizationId) {
      // Fallback: crear organización basada en dominio del email
      const emailDomain = email.split('@')[1];
      const domainSlug = emailDomain
        .split('.')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
      
      organization = await this.organizationRepository.findOne({
        where: { slug: domainSlug, isActive: true },
      });
      
      if (!organization) {
        organization = this.organizationRepository.create({
          name: `${emailDomain.split('.')[0].toUpperCase()} Corp`,
          slug: domainSlug,
          isActive: true,
        });
        
        organization = await this.organizationRepository.save(organization);
        console.log(`🏢 Organización generada: ${organization.name} (${domainSlug})`);
      }
      
      targetOrganizationId = organization.id;
    } else {
      // Verificar que la organización existe y está activa
      organization = await this.organizationRepository.findOne({
        where: { id: targetOrganizationId, isActive: true },
      });
      
      if (!organization) {
        throw new BadRequestException('La organización especificada no existe o está inactiva');
      }
    }

    // Verificar si el usuario ya existe en la misma organización
    const existingUser = await this.userRepository.findOne({
      where: { 
        email,
        organizationId: targetOrganizationId 
      },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya existe con este email en esta organización');
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
      await this.seedService.createSampleDataForOrganization(targetOrganizationId, user);
      console.log(`🌱 Datos de muestra creados para usuario: ${user.email}`);
    } catch (seedError) {
      console.error(`❌ Error creando datos de muestra para ${user.email}:`, seedError);
      // No fallar el registro si hay error en el seed, solo loguearlo
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

  async login(loginDto: LoginDto, organizationId?: string): Promise<AuthResponse> {
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
        'phone'
      ],
      relations: ['organization'],
    });

    if (!user) {
      console.error('❌ AuthService.validateUser: User not found', { userId: id });
      throw new UnauthorizedException('Token inválido');
    }

    // Verificar que el usuario tenga un rol asignado
    if (!user.role) {
      console.error('❌ AuthService.validateUser: User has no role', { 
        userId: user.id, 
        email: user.email 
      });
      throw new UnauthorizedException('Usuario sin rol asignado');
    }

    // Verificar que tenga una organización asignada
    if (!user.organizationId) {
      console.error('❌ AuthService.validateUser: User has no organization', { 
        userId: user.id, 
        email: user.email 
      });
      throw new UnauthorizedException('Usuario sin organización asignada');
    }

    // Verificar que la organización del usuario esté activa
    if (user.organization && !user.organization.isActive) {
      console.error('❌ AuthService.validateUser: Organization is inactive', {
        userId: user.id,
        organizationId: user.organizationId,
        organizationSlug: user.organization.slug
      });
      throw new UnauthorizedException('La organización está inactiva');
    }

    // Si no se encontró la organización en la relación, buscarla
    if (!user.organization) {
      const organization = await this.organizationRepository.findOne({
        where: { id: user.organizationId, isActive: true }
      });
      
      if (!organization) {
        console.error('❌ AuthService.validateUser: Organization not found or inactive', {
          userId: user.id,
          organizationId: user.organizationId
        });
        throw new UnauthorizedException('Organización no encontrada o inactiva');
      }
      
      user.organization = organization;
    }

    console.log('✅ AuthService.validateUser: User validated successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
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
}
