import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

// Extender el tipo Request para incluir la información del tenant
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string;
        slug: string;
        organization: Organization;
      };
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      let tenantSlug: string | null = null;
      let organizationId: string | null = null;

      // Estrategia 1: Para rutas autenticadas, obtener organización del JWT
      const authHeader = req.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          // Decodificar el JWT sin verificar (solo para obtener el payload)
          const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64').toString(),
          );

          if (payload.id) {
            // Buscar el usuario para obtener su organizationId
            const { Repository } = await import('typeorm');
            const { User } = await import('../../users/entities/user.entity');
            const { getRepository } = await import('typeorm');

            // Como no tenemos acceso directo al repositorio aquí, buscaremos por ID usando una query directa
            const userQuery = await this.organizationRepository.manager.query(
              'SELECT organization_id FROM users WHERE id = $1 AND status = $2',
              [payload.id, 'active'],
            );

            if (userQuery && userQuery.length > 0) {
              organizationId = userQuery[0].organization_id;
            }
          }
        } catch (jwtError) {
          // Si hay error decodificando JWT, continuar con estrategias normales
          console.log(
            'JWT decode error (normal for invalid tokens):',
            jwtError.message,
          );
        }
      }

      // Estrategia 2: Obtener tenant desde subdominio (solo para dominios reales, no IPs)
      // Solo usar esta estrategia si el JWT no proporcionó un organizationId
      if (!organizationId) {
        const hostname = req.get('host') || req.hostname;
        if (hostname && hostname.includes('.') && !this.isIPAddress(hostname)) {
          const parts = hostname.split('.');
          // Solo extraer subdomain si hay 3+ partes (sub.domain.tld)
          // Para dominios como "baudex.baudity.tech", "baudex" es el subdominio del servicio, no un tenant
          if (parts.length > 3) {
            const subdomain = parts[0];
            // Excluir subdominios comunes del sistema
            if (
              !['www', 'api', 'admin', 'app'].includes(
                subdomain.toLowerCase(),
              )
            ) {
              tenantSlug = subdomain.toLowerCase();
            }
          }
        }
      }

      // Estrategia 3: Obtener tenant desde header personalizado (para desarrollo/testing)
      if (!organizationId && !tenantSlug) {
        tenantSlug = req.get('X-Tenant-Slug')?.toLowerCase() || null;
      }

      // Estrategia 4: Obtener tenant desde query parameter (solo para desarrollo)
      if (
        !organizationId &&
        !tenantSlug &&
        process.env.NODE_ENV === 'development'
      ) {
        tenantSlug = (req.query.tenant as string)?.toLowerCase() || null;
      }

      // MULTITENANT: Para auth endpoints, permitir continuar sin tenant específico
      const isAuthEndpoint =
        req.path === '/auth/register' ||
        req.path === '/auth/login' ||
        req.path === '/api/auth/register' ||
        req.path === '/api/auth/login';
      if (isAuthEndpoint && !tenantSlug && !organizationId) {
        // Permitir auth sin tenant específico - se manejará en el AuthService
        next();
        return;
      }

      let organization;

      // Si tenemos organizationId del JWT, buscar por ID
      if (organizationId) {
        organization = await this.organizationRepository.findOne({
          where: {
            id: organizationId,
            isActive: true,
          },
          cache: {
            id: `org-id-${organizationId}`,
            milliseconds: 300000, // Cache por 5 minutos
          },
        });
      }
      // Si no, buscar por slug
      else if (tenantSlug) {
        organization = await this.organizationRepository.findOne({
          where: {
            slug: tenantSlug,
            isActive: true,
          },
          cache: {
            id: `org-${tenantSlug}`,
            milliseconds: 300000, // Cache por 5 minutos
          },
        });
      }
      // Estrategia 5: Usar organización por defecto si no se especifica
      else {
        tenantSlug = process.env.DEFAULT_TENANT_SLUG || 'default';
        organization = await this.organizationRepository.findOne({
          where: {
            slug: tenantSlug,
            isActive: true,
          },
          cache: {
            id: `org-${tenantSlug}`,
            milliseconds: 300000, // Cache por 5 minutos
          },
        });
      }

      if (!organization) {
        throw new BadRequestException(
          `Organización no encontrada o inactiva: ${organizationId || tenantSlug}`,
        );
      }

      // Adjuntar información del tenant al request
      req.tenant = {
        id: organization.id,
        slug: organization.slug,
        organization,
      };

      // Agregar headers de respuesta para debugging
      if (process.env.NODE_ENV === 'development') {
        res.set('X-Current-Tenant', organization.slug);
        res.set('X-Current-Tenant-ID', organization.id);
        res.set('X-Tenant-Source', organizationId ? 'jwt' : 'slug');
      }

      next();
    } catch (error) {
      // En caso de error, usar organización por defecto para rutas de sistema
      const isSystemRoute =
        req.path.startsWith('/health') ||
        req.path.startsWith('/api-docs') ||
        req.path === '/' ||
        req.path.startsWith('/auth/system') ||
        req.path === '/auth/register' ||
        req.path === '/api/auth/register' || // MULTITENANT: Permitir registro sin tenant
        req.path === '/auth/login' ||
        req.path === '/api/auth/login'; // MULTITENANT: Permitir login sin tenant

      if (isSystemRoute) {
        // Para rutas de sistema, no requerir tenant específico
        next();
        return;
      }

      // Para rutas que requieren tenant, propagar el error
      next(error);
    }
  }

  /**
   * Verifica si el hostname es una dirección IP (IPv4 o IPv6)
   */
  private isIPAddress(hostname: string): boolean {
    // Remover puerto si existe
    const host = hostname.split(':')[0];

    // Verificar IPv4 (formato: 192.168.1.8)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(host)) {
      return true;
    }

    // Verificar IPv6 (contiene ':')
    if (host.includes(':')) {
      return true;
    }

    // También considerar localhost como IP para este contexto
    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }

    return false;
  }
}
