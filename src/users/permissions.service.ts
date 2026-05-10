import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PermissionModuleCode,
  UserModulePermission,
} from './entities/user-module-permission.entity';
import { User, UserRole } from './entities/user.entity';
import { TenantAwareService } from '../common/services/tenant-aware.service';
import { ModulePermissionDto } from './dto/set-permissions.dto';

/**
 * Servicio de permisos granulares por módulo.
 *
 * Reglas:
 * - **admin**: SIEMPRE tiene todos los permisos. Los registros en BD se
 *   ignoran. La UI no debe permitir editar permisos de un admin.
 * - **manager** / **user**: respeta `user_module_permissions`. Si NO hay
 *   filas para un módulo, se aplican defaults por rol (ver `_defaultsForRole`).
 */
@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(UserModulePermission)
    private readonly permRepository: Repository<UserModulePermission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  /**
   * Lista los códigos de módulo soportados (sirve al frontend para
   * generar la UI dinámicamente sin hardcodear).
   */
  static readonly ALL_MODULES: PermissionModuleCode[] = [
    PermissionModuleCode.DASHBOARD,
    PermissionModuleCode.INVOICES,
    PermissionModuleCode.EXPENSES,
    PermissionModuleCode.CUSTOMERS,
    PermissionModuleCode.PRODUCTS,
    PermissionModuleCode.INVENTORY,
    PermissionModuleCode.PURCHASE_ORDERS,
    PermissionModuleCode.BANK_ACCOUNTS,
    PermissionModuleCode.CASH_REGISTER,
    PermissionModuleCode.REPORTS,
    PermissionModuleCode.SETTINGS,
    PermissionModuleCode.EMPLOYEES,
  ];

  /**
   * Obtiene los permisos efectivos del usuario (con defaults por rol
   * cuando no hay registro en BD). Útil para el frontend al login y al
   * cargar el dialog de "Configurar permisos".
   *
   * Aislamiento: solo devuelve permisos del usuario si pertenece al
   * tenant del request actual.
   */
  async getEffectivePermissions(
    userId: string,
  ): Promise<ModulePermissionDto[]> {
    const tenantId = this.requireTenant();
    const user = await this.userRepository.findOne({
      where: { id: userId, organizationId: tenantId },
      select: ['id', 'role', 'organizationId'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Admin: todos los permisos máximos. La BD se ignora.
    if (user.role === UserRole.ADMIN) {
      return PermissionsService.ALL_MODULES.map((m) => ({
        moduleCode: m,
        canView: true,
        canEdit: true,
        canDelete: true,
      }));
    }

    const stored = await this.permRepository.find({
      where: { userId, organizationId: tenantId },
    });
    const map = new Map<PermissionModuleCode, UserModulePermission>(
      stored.map((p) => [p.moduleCode, p]),
    );

    return PermissionsService.ALL_MODULES.map((m) => {
      const existing = map.get(m);
      if (existing) {
        return {
          moduleCode: m,
          canView: existing.canView,
          canEdit: existing.canEdit,
          canDelete: existing.canDelete,
        };
      }
      return this._defaultsForRole(m, user.role);
    });
  }

  /**
   * Reemplaza el set completo de permisos del usuario. Hace upsert
   * de cada (userId, moduleCode).
   *
   * - No se permite editar permisos de un admin (siempre tiene todos).
   * - El usuario objetivo debe pertenecer al mismo tenant que el caller.
   */
  async setPermissions(
    targetUserId: string,
    permissions: ModulePermissionDto[],
  ): Promise<ModulePermissionDto[]> {
    const tenantId = this.requireTenant();
    const target = await this.userRepository.findOne({
      where: { id: targetUserId, organizationId: tenantId },
      select: ['id', 'role', 'organizationId'],
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (target.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Los administradores tienen todos los permisos por defecto. ' +
          'Para restringir a un admin, primero cambia su rol a manager o user.',
      );
    }

    // Upsert por cada módulo recibido. Solo aceptamos módulos válidos
    // (validado también en DTO). Los módulos no listados se mantienen
    // intactos.
    const validModules = new Set<PermissionModuleCode>(
      PermissionsService.ALL_MODULES,
    );
    for (const p of permissions) {
      if (!validModules.has(p.moduleCode)) continue;
      const existing = await this.permRepository.findOne({
        where: {
          userId: targetUserId,
          moduleCode: p.moduleCode,
        },
      });
      if (existing) {
        existing.canView = p.canView;
        existing.canEdit = p.canEdit;
        existing.canDelete = p.canDelete;
        await this.permRepository.save(existing);
      } else {
        await this.permRepository.save(
          this.permRepository.create({
            userId: targetUserId,
            organizationId: tenantId,
            moduleCode: p.moduleCode,
            canView: p.canView,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
          }),
        );
      }
    }

    return this.getEffectivePermissions(targetUserId);
  }

  /**
   * Defaults por rol cuando NO hay un registro explícito en
   * `user_module_permissions`. Mantener conservador: el admin del
   * tenant decide qué dar acceso.
   */
  private _defaultsForRole(
    module: PermissionModuleCode,
    role: UserRole,
  ): ModulePermissionDto {
    if (role === UserRole.MANAGER) {
      // Manager por defecto puede ver y editar la mayoría, pero NO eliminar
      // en módulos sensibles (cuentas bancarias, configuración global,
      // empleados — eso queda solo para admin).
      const adminOnlyDelete = new Set<PermissionModuleCode>([
        PermissionModuleCode.BANK_ACCOUNTS,
        PermissionModuleCode.SETTINGS,
        PermissionModuleCode.EMPLOYEES,
      ]);
      return {
        moduleCode: module,
        canView: true,
        canEdit: true,
        canDelete: !adminOnlyDelete.has(module),
      };
    }
    // USER: solo lectura básica.
    const readableForUser = new Set<PermissionModuleCode>([
      PermissionModuleCode.DASHBOARD,
      PermissionModuleCode.INVOICES,
      PermissionModuleCode.CUSTOMERS,
      PermissionModuleCode.PRODUCTS,
      PermissionModuleCode.CASH_REGISTER,
    ]);
    return {
      moduleCode: module,
      canView: readableForUser.has(module),
      canEdit: false,
      canDelete: false,
    };
  }

  private requireTenant(): string {
    const tenantId = this.tenantAwareService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Contexto de tenant no disponible');
    }
    return tenantId;
  }
}
