import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Verificar que el usuario existe y tiene rol
    if (!user) {
      console.error('❌ RolesGuard: No user found in request');
      return false;
    }

    if (!user.role) {
      console.error('❌ RolesGuard: User has no role assigned', {
        userId: user.id,
        userEmail: user.email,
        organizationId: user.organizationId,
      });
      return false;
    }

    const hasRequiredRole = requiredRoles.some((role) => user.role === role);

    if (!hasRequiredRole) {
      console.warn('⚠️ RolesGuard: User does not have required role', {
        userRole: user.role,
        requiredRoles,
        userId: user.id,
      });
    }

    return hasRequiredRole;
  }
}
