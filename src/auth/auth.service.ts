import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, MoreThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { ActiveSession } from './entities/active-session.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';
import { SeedService } from '../common/services/seed.service';
import { SubscriptionService } from '../subscriptions/services/subscription.service';
import {
  getPlanLimits,
  isUnlimited,
} from '../subscriptions/config/plan-limits.config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(ActiveSession)
    private readonly activeSessionRepository: Repository<ActiveSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly seedService: SeedService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async register(
    registerDto: RegisterDto,
    organizationId?: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    const {
      email,
      password,
      firstName,
      lastName,
      role = UserRole.MANAGER,
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

    // Verificar si el usuario ya existe en la misma organización (case-insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(${alias}) = :email`, {
          email: normalizedEmail,
        }),
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
      email: normalizedEmail,
      password, // Se encriptará automáticamente
      firstName,
      lastName,
      role,
      status: UserStatus.ACTIVE,
      organizationId: targetOrganizationId,
    });

    await this.userRepository.save(user);

    // GARANTIZADO: Crear almacén principal para la organización
    try {
      await this.seedService.createMainWarehouse(targetOrganizationId);
      console.log(
        `🏪 Almacén principal garantizado para: ${organization.name}`,
      );
    } catch (warehouseError) {
      console.error(
        `❌ Error creando almacén principal para ${organization.name}:`,
        warehouseError,
      );
      // No fallar el registro si hay error en el almacén, solo loguearlo
    }

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

    // Crear sesión activa y generar token con jti
    const jti = randomUUID();
    const token = this.getJwtToken({ id: user.id, jti });

    // Registrar sesión (no bloquear registro si falla)
    try {
      await this.createSession(
        user.id,
        targetOrganizationId,
        jti,
        deviceInfo,
        ipAddress,
      );
      console.log(`📱 Sesión creada para nuevo usuario: ${user.email}`);
    } catch (sessionError) {
      console.error(
        `❌ Error creando sesión para ${user.email}:`,
        sessionError,
      );
    }

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
    deviceInfo?: string,
    ipAddress?: string,
    deviceId?: string,
  ): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Buscar usuario activo con email case-insensitive
    const whereCondition: any = {
      email: Raw((alias) => `LOWER(${alias}) = LOWER(:email)`, {
        email: email.trim(),
      }),
      status: UserStatus.ACTIVE,
    };

    // Si se especifica organizationId, agregarlo a la búsqueda
    if (organizationId) {
      whereCondition.organizationId = organizationId;
    }

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

    // Revocar sesión anterior del mismo dispositivo (evita duplicados)
    await this.revokeExistingDeviceSession(user.id, deviceInfo, deviceId);

    // Verificar límite de dispositivos según plan de suscripción
    await this.checkDeviceLimit(user.id, user.organizationId);

    // Actualizar último login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Crear sesión activa y generar token con jti
    const jti = randomUUID();
    const token = this.getJwtToken({ id: user.id, jti });

    // Registrar sesión (incluye deviceId para match futuro)
    const enrichedDeviceInfo = deviceId && deviceInfo
      ? `${deviceInfo} [${deviceId}]`
      : deviceInfo;
    await this.createSession(
      user.id,
      user.organizationId,
      jti,
      enrichedDeviceInfo,
      ipAddress,
    );

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
    const { id, jti } = payload;

    // Verificar sesión activa si tiene jti (tokens nuevos)
    if (jti) {
      const session = await this.activeSessionRepository.findOne({
        where: {
          jti,
          isActive: true,
          expiresAt: MoreThan(new Date()),
        },
      });

      if (!session) {
        throw new UnauthorizedException(
          'Sesión expirada o revocada. Por favor inicia sesión nuevamente.',
        );
      }

      // Actualizar lastActivityAt (fire-and-forget)
      this.activeSessionRepository.update(session.id, {
        lastActivityAt: new Date(),
      }).catch(() => {});
    }

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

    return user;
  }

  public getJwtToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  async refreshToken(user: User): Promise<{ token: string }> {
    const token = this.getJwtToken({ id: user.id });
    return { token };
  }

  // ==================== LOGOUT ====================

  /**
   * Cerrar sesión actual: revocar la sesión identificada por jti
   */
  async logout(jti?: string): Promise<{ message: string }> {
    if (!jti) {
      return { message: 'Sesión cerrada (sin jti)' };
    }

    const session = await this.activeSessionRepository.findOne({
      where: { jti },
    });

    if (session) {
      session.isActive = false;
      await this.activeSessionRepository.save(session);
      console.log(`🔓 Sesión revocada por logout: jti=${jti.substring(0, 8)}...`);
    }

    return { message: 'Sesión cerrada exitosamente' };
  }

  // ==================== GESTIÓN DE SESIONES ====================

  /**
   * Verificar límite de dispositivos según plan de suscripción.
   * Si el límite se alcanza, BLOQUEA el login y pide al usuario
   * que cierre sesión en otro dispositivo primero.
   */
  private async checkDeviceLimit(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    // Paso 1: Limpiar sesiones stale (sin actividad en 48h+)
    await this.cleanupStaleSessions(userId);

    // Paso 2: Determinar límite según plan
    let maxDevices = 2; // default sin suscripción
    let planName = 'Plan de Prueba';

    const subscription =
      await this.subscriptionService.getActiveSubscription(organizationId);

    if (subscription) {
      const limits = getPlanLimits(subscription.plan);
      maxDevices = limits.maxDevices;
      planName = this.getPlanDisplayName(subscription.plan);
    }

    // Si es ilimitado, no verificar
    if (isUnlimited(maxDevices)) {
      return;
    }

    // Paso 3: Si se alcanzó el límite, BLOQUEAR el login
    const activeCount = await this.getActiveSessionCount(userId);

    if (activeCount >= maxDevices) {
      console.log(
        `🚫 Límite de dispositivos alcanzado: ${activeCount}/${maxDevices} para usuario ${userId.substring(0, 8)}...`,
      );
      throw new ForbiddenException(
        `Has alcanzado el límite de ${maxDevices} dispositivo(s) permitido(s) en tu ${planName}. ` +
          `Cierra sesión en uno de tus dispositivos conectados e intenta de nuevo.`,
      );
    }
  }

  /**
   * Obtener nombre legible del plan
   */
  private getPlanDisplayName(plan: string): string {
    const names: Record<string, string> = {
      trial: 'Plan de Prueba',
      basic: 'Plan Básico',
      premium: 'Plan Premium',
      enterprise: 'Plan Empresarial',
    };
    return names[plan] || 'Plan actual';
  }

  /**
   * Revocar sesiones sin actividad en las últimas 48 horas.
   * Previene bloqueos cuando el usuario cerró la app sin hacer logout.
   */
  private async cleanupStaleSessions(userId: string): Promise<void> {
    const staleThreshold = new Date();
    staleThreshold.setHours(staleThreshold.getHours() - 48);

    const staleSessions = await this.activeSessionRepository.find({
      where: {
        userId,
        isActive: true,
        lastActivityAt: Raw(
          (alias) => `${alias} < :threshold`,
          { threshold: staleThreshold.toISOString() },
        ),
      },
    });

    if (staleSessions.length > 0) {
      for (const session of staleSessions) {
        session.isActive = false;
        await this.activeSessionRepository.save(session);
      }
      console.log(
        `🧹 ${staleSessions.length} sesiones stale revocadas para usuario ${userId.substring(0, 8)}...`,
      );
    }
  }

  /**
   * Revocar sesión anterior del mismo dispositivo para evitar duplicados.
   * Prioridad: deviceId (X-Device-ID header) > deviceInfo (User-Agent).
   * El deviceId es un UUID único generado por el cliente y persistido localmente.
   */
  private async revokeExistingDeviceSession(
    userId: string,
    deviceInfo?: string,
    deviceId?: string,
  ): Promise<void> {
    let existingSessions: ActiveSession[] = [];

    // Prioridad 1: Buscar por deviceId exacto (más confiable)
    if (deviceId) {
      existingSessions = await this.activeSessionRepository.find({
        where: {
          userId,
          deviceInfo: Raw(
            (alias) => `${alias} LIKE :pattern`,
            { pattern: `%[${deviceId}]%` },
          ),
          isActive: true,
        },
      });
    }

    // Prioridad 2: Buscar por deviceInfo exacto (User-Agent)
    if (existingSessions.length === 0 && deviceInfo && deviceInfo !== 'Unknown') {
      existingSessions = await this.activeSessionRepository.find({
        where: {
          userId,
          deviceInfo,
          isActive: true,
        },
      });
    }

    if (existingSessions.length > 0) {
      for (const session of existingSessions) {
        session.isActive = false;
        await this.activeSessionRepository.save(session);
      }
      console.log(
        `🔄 ${existingSessions.length} sesión(es) anterior(es) del mismo dispositivo revocada(s) para usuario ${userId.substring(0, 8)}...`,
      );
    }
  }

  /**
   * Contar sesiones activas de un usuario
   */
  private async getActiveSessionCount(userId: string): Promise<number> {
    return this.activeSessionRepository.count({
      where: {
        userId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  /**
   * Crear una nueva sesión activa
   */
  private async createSession(
    userId: string,
    organizationId: string,
    jti: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<ActiveSession> {
    // Calcular fecha de expiración basada en JWT_EXPIRES_IN
    const expiresIn = this.configService.get('JWT_EXPIRES_IN', '7d');
    const expiresAt = this.calculateExpirationDate(expiresIn);

    const session = this.activeSessionRepository.create({
      userId,
      organizationId,
      jti,
      deviceInfo: deviceInfo || 'Unknown',
      ipAddress: ipAddress || 'Unknown',
      lastActivityAt: new Date(),
      expiresAt,
      isActive: true,
    });

    return this.activeSessionRepository.save(session);
  }

  /**
   * Obtener sesiones activas del usuario
   */
  async getUserSessions(userId: string): Promise<ActiveSession[]> {
    return this.activeSessionRepository.find({
      where: {
        userId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Revocar una sesión específica
   */
  async revokeSession(
    sessionId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const session = await this.activeSessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Sesión no encontrada');
    }

    session.isActive = false;
    await this.activeSessionRepository.save(session);

    return { message: 'Sesión revocada exitosamente' };
  }

  /**
   * Revocar todas las sesiones excepto la actual
   */
  async revokeAllSessionsExcept(
    userId: string,
    currentJti?: string,
  ): Promise<{ message: string; revokedCount: number }> {
    const sessions = await this.activeSessionRepository.find({
      where: {
        userId,
        isActive: true,
      },
    });

    let revokedCount = 0;
    for (const session of sessions) {
      if (session.jti !== currentJti) {
        session.isActive = false;
        await this.activeSessionRepository.save(session);
        revokedCount++;
      }
    }

    return {
      message: `${revokedCount} sesiones revocadas exitosamente`,
      revokedCount,
    };
  }

  /**
   * CRON: Limpiar sesiones expiradas cada 6 horas
   */
  @Cron('0 */6 * * *')
  async cleanupExpiredSessions(): Promise<void> {
    console.log('🧹 Limpiando sesiones expiradas...');

    const result = await this.activeSessionRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .orWhere('is_active = :inactive', { inactive: false })
      .execute();

    console.log(`✅ ${result.affected || 0} sesiones expiradas eliminadas`);
  }

  /**
   * Calcular fecha de expiración desde string como "7d", "24h", "30m"
   */
  private calculateExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([dhms])$/);

    if (!match) {
      // Default: 7 días
      now.setDate(now.getDate() + 7);
      return now;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd':
        now.setDate(now.getDate() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      case 's':
        now.setSeconds(now.getSeconds() + value);
        break;
      default:
        now.setDate(now.getDate() + 7);
    }

    return now;
  }

  // ==================== VALIDACIÓN DE CONTRASEÑA ====================

  /**
   * Validar contraseña del usuario para operaciones sensibles
   */
  async validatePassword(
    userId: string,
    password: string,
  ): Promise<{ valid: boolean; message: string }> {
    // Validar que se proporcione la contraseña
    if (!password || password.trim() === '') {
      throw new BadRequestException('La contraseña es requerida');
    }

    // Buscar el usuario por ID
    const user = await this.userRepository.findOne({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: ['id', 'email', 'password'],
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Verificar la contraseña usando bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log(
        `🔒 Intento de validación de contraseña fallido para usuario ${user.email}`,
      );
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    console.log(
      `✅ Contraseña validada exitosamente para usuario ${user.email}`,
    );

    return {
      valid: true,
      message: 'Contraseña válida',
    };
  }

  /**
   * Genera un ID único para usar en nombres de organizaciones
   */
  private generateUniqueId(): string {
    return randomUUID();
  }
}
