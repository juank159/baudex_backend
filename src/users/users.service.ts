// src/modules/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User, UserStatus, UserRole } from './entities/user.entity';
import { PaginatedResponseDto } from '../common/dto/pagination-response.dto';
import { TenantAwareService } from '../common/services/tenant-aware.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  /**
   * Devuelve el organizationId del tenant del request actual.
   * Lanza UnauthorizedException si no hay contexto de tenant.
   * CRÍTICO: usar en TODOS los métodos del CRUD de empleados para
   * garantizar aislamiento entre tenants.
   */
  private getCurrentTenantId(): string {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException(
        'Contexto de tenant no disponible',
      );
    }
    return tenantId;
  }

  // ==================== MÉTODOS DE CREACIÓN ====================

  /**
   * Crear un nuevo usuario
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const tenantId = this.getCurrentTenantId();

    // Verificar si el email ya existe (global, ya que email es único cross-tenant)
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Crear usuario asociado al tenant del request — NUNCA confiar en
    // organizationId del body para evitar que un admin cree usuarios en
    // otro tenant.
    const user = this.userRepository.create({
      ...createUserDto,
      organizationId: tenantId,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);

    // Remover password del resultado
    delete savedUser.password;
    return savedUser;
  }

  // ==================== MÉTODOS DE CONSULTA ====================

  /**
   * Obtener todos los usuarios con paginación y filtros
   */
  async findAll(query: UserQueryDto): Promise<PaginatedResponseDto<User>> {
    const tenantId = this.getCurrentTenantId();
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.phone',
        'user.role',
        'user.status',
        'user.avatar',
        'user.lastLoginAt',
        'user.createdAt',
        'user.updatedAt',
      ])
      // CRÍTICO: aislamiento multi-tenant. Sin esto, cada admin ve
      // empleados de TODAS las organizaciones — bug grave de privacidad.
      .where('user.organizationId = :tenantId', { tenantId });

    // Filtros adicionales
    if (search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    // Ordenamiento
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Paginación
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Obtener un usuario por ID, restringido al tenant actual.
   * CRÍTICO: aislamiento multi-tenant. Un admin no puede leer un
   * usuario de OTRO tenant aunque conozca el UUID.
   */
  async findOne(id: string): Promise<User> {
    const tenantId = this.getCurrentTenantId();
    const user = await this.userRepository.findOne({
      where: { id, organizationId: tenantId },
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'phone',
        'role',
        'status',
        'avatar',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Variante SIN filtro de tenant. Solo para uso interno (auth flow,
   * validación de tokens, JwtStrategy). NO exponer en endpoints públicos.
   */
  async findOneAnyTenant(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'phone',
        'role',
        'status',
        'avatar',
        'organizationId',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Obtener usuario por email (sin password por defecto)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(${alias}) = LOWER(:email)`, {
          email: email.trim(),
        }),
      },
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'phone',
        'role',
        'status',
        'avatar',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  /**
   * Obtener usuario por email con password (para autenticación)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(${alias}) = LOWER(:email)`, {
          email: email.trim(),
        }),
        status: UserStatus.ACTIVE,
      },
      select: [
        'id',
        'email',
        'password',
        'firstName',
        'lastName',
        'role',
        'status',
      ],
    });
  }

  /**
   * Obtener usuario activo por ID (para validación de tokens)
   */
  async findActiveById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, status: UserStatus.ACTIVE },
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'phone',
        'role',
        'status',
        'avatar',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  // ==================== MÉTODOS DE ACTUALIZACIÓN ====================

  /**
   * Actualizar un usuario
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const tenantId = this.getCurrentTenantId();
    const user = await this.userRepository.findOne({
      where: { id, organizationId: tenantId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar email único si se está actualizando
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    // Manejar actualización de contraseña de forma segura
    if (updateUserDto.password) {
      await user.setPassword(updateUserDto.password);
      delete updateUserDto.password; // Remover del DTO
    }

    // Actualizar otros campos
    Object.assign(user, updateUserDto);

    const updatedUser = await this.userRepository.save(user);

    // Remover password del resultado
    delete updatedUser.password;
    return updatedUser;
  }

  /**
   * Cambiar contraseña del usuario
   */
  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword, confirmPassword } = changePasswordDto;

    // Validar que las nuevas contraseñas coincidan
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Las contraseñas nuevas no coinciden');
    }

    // Validar que la nueva contraseña sea diferente a la actual
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    // Obtener usuario con contraseña
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'email', 'password', 'firstName', 'lastName'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar contraseña actual
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    // Cambiar contraseña
    await user.setPassword(newPassword);
    await this.userRepository.save(user);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  /**
   * Actualizar estado del usuario
   */
  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const tenantId = this.getCurrentTenantId();
    const user = await this.userRepository.findOne({
      where: { id, organizationId: tenantId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.status = status;
    const updatedUser = await this.userRepository.save(user);

    delete updatedUser.password;
    return updatedUser;
  }

  /**
   * Actualizar último login
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
    });
  }

  /**
   * Actualizar avatar del usuario
   */
  async updateAvatar(id: string, avatarUrl: string): Promise<User> {
    const tenantId = this.getCurrentTenantId();
    const user = await this.userRepository.findOne({
      where: { id, organizationId: tenantId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.avatar = avatarUrl;
    const updatedUser = await this.userRepository.save(user);

    delete updatedUser.password;
    return updatedUser;
  }

  // ==================== MÉTODOS DE ELIMINACIÓN ====================

  /**
   * Eliminación suave de usuario
   */
  async softDelete(id: string): Promise<{ message: string }> {
    const tenantId = this.getCurrentTenantId();
    const user = await this.userRepository.findOne({
      where: { id, organizationId: tenantId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // No permitir eliminar el último admin activo del MISMO tenant
    if (user.role === UserRole.ADMIN) {
      const activeAdmins = await this.userRepository.count({
        where: {
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          organizationId: tenantId,
        },
      });

      if (activeAdmins <= 1) {
        throw new ForbiddenException(
          'No se puede eliminar el último administrador activo',
        );
      }
    }

    await this.userRepository.softRemove(user);
    return { message: 'Usuario eliminado exitosamente' };
  }

  /**
   * Restaurar usuario eliminado
   */
  async restore(id: string): Promise<User> {
    const tenantId = this.getCurrentTenantId();
    const user = await this.userRepository.findOne({
      where: { id, organizationId: tenantId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.deletedAt) {
      throw new BadRequestException('El usuario no está eliminado');
    }

    await this.userRepository.restore(id);

    // Retornar usuario restaurado
    const restoredUser = await this.findOne(id);
    return restoredUser;
  }

  // ==================== MÉTODOS DE ESTADÍSTICAS ====================

  /**
   * Obtener estadísticas de usuarios
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    byRole: Record<string, number>;
    activePercentage: number;
    recentRegistrations: number;
  }> {
    const tenantId = this.getCurrentTenantId();
    const total = await this.userRepository.count({
      where: { organizationId: tenantId },
    });
    const active = await this.userRepository.count({
      where: { status: UserStatus.ACTIVE, organizationId: tenantId },
    });
    const inactive = await this.userRepository.count({
      where: { status: UserStatus.INACTIVE, organizationId: tenantId },
    });
    const suspended = await this.userRepository.count({
      where: { status: UserStatus.SUSPENDED, organizationId: tenantId },
    });

    // Estadísticas por rol (solo del tenant actual)
    const adminCount = await this.userRepository.count({
      where: { role: UserRole.ADMIN, organizationId: tenantId },
    });
    const managerCount = await this.userRepository.count({
      where: { role: UserRole.MANAGER, organizationId: tenantId },
    });
    const userCount = await this.userRepository.count({
      where: { role: UserRole.USER, organizationId: tenantId },
    });

    // Registros recientes (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await this.userRepository.count({
      where: {
        organizationId: tenantId,
        createdAt: {
          $gte: thirtyDaysAgo,
        } as any,
      },
    });

    return {
      total,
      active,
      inactive,
      suspended,
      byRole: {
        admin: adminCount,
        manager: managerCount,
        user: userCount,
      },
      activePercentage:
        total > 0 ? Number(((active / total) * 100).toFixed(2)) : 0,
      recentRegistrations,
    };
  }

  /**
   * Buscar usuarios por término
   */
  async search(searchTerm: string, limit: number = 10): Promise<User[]> {
    const tenantId = this.getCurrentTenantId();
    return this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.role',
        'user.status',
        'user.avatar',
      ])
      .where('user.organizationId = :tenantId', { tenantId })
      .andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .orderBy('user.firstName', 'ASC')
      .limit(limit)
      .getMany();
  }

  // ==================== MÉTODOS DE VALIDACIÓN ====================

  /**
   * Verificar si un email está disponible
   */
  async isEmailAvailable(email: string, excludeId?: string): Promise<boolean> {
    // Email es único GLOBAL (cross-tenant) en el sistema, así que la
    // verificación NO se filtra por tenant — un email ya usado en otro
    // tenant tampoco se puede reutilizar aquí.
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() });

    if (excludeId) {
      query.andWhere('user.id != :excludeId', { excludeId });
    }

    const count = await query.getCount();
    return count === 0;
  }

  /**
   * Verificar si un usuario puede realizar una acción
   */
  async canPerformAction(
    userId: string,
    targetUserId: string,
    action: string,
  ): Promise<boolean> {
    const user = await this.findOne(userId);
    const targetUser = await this.findOne(targetUserId);

    // Los admins pueden hacer todo
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Los managers solo pueden actuar sobre usuarios regulares
    if (user.role === UserRole.MANAGER && targetUser.role === UserRole.USER) {
      return true;
    }

    // Los usuarios solo pueden actuar sobre sí mismos
    if (user.role === UserRole.USER && userId === targetUserId) {
      return ['update', 'changePassword', 'updateAvatar'].includes(action);
    }

    return false;
  }
}
