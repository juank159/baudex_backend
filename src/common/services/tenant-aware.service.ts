import { Injectable, Scope } from '@nestjs/common';
import {
  Repository,
  FindManyOptions,
  FindOneOptions,
  SelectQueryBuilder,
} from 'typeorm';
import { Request } from 'express';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';

// Interface para entidades que tienen organization_id
export interface TenantAwareEntity {
  organizationId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class TenantAwareService {
  private tenantId: string | null = null;

  constructor(@Inject(REQUEST) private readonly request: Request) {
    // Obtener el tenant ID del request actual
    this.tenantId = this.request.tenant?.id || null;
  }

  // Método para obtener el tenant ID actual
  getTenantId(): string | null {
    return this.tenantId;
  }

  // Método para agregar filtro de tenant a las opciones de búsqueda
  addTenantFilter<T extends TenantAwareEntity>(
    options: FindManyOptions<T> = {},
  ): FindManyOptions<T> {
    if (!this.tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    return {
      ...options,
      where: {
        ...(options.where as any),
        organizationId: this.tenantId,
      } as any,
    };
  }

  // Método para agregar filtro de tenant a las opciones de búsqueda de uno
  addTenantFilterOne<T extends TenantAwareEntity>(
    options: FindOneOptions<T> = {},
  ): FindOneOptions<T> {
    if (!this.tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    return {
      ...options,
      where: {
        ...(options.where as any),
        organizationId: this.tenantId,
      } as any,
    };
  }

  // Método para agregar filtro de tenant a un QueryBuilder
  addTenantFilterToQueryBuilder<T extends TenantAwareEntity>(
    queryBuilder: SelectQueryBuilder<T>,
    alias?: string,
  ): SelectQueryBuilder<T> {
    if (!this.tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    const entityAlias = alias || queryBuilder.alias;
    return queryBuilder.andWhere(`${entityAlias}.organizationId = :tenantId`, {
      tenantId: this.tenantId,
    });
  }

  // Método para agregar organization_id a los datos de creación
  addTenantToEntity<T extends Partial<TenantAwareEntity>>(
    entity: T,
  ): T & { organizationId: string } {
    if (!this.tenantId) {
      throw new Error('No se pudo determinar el tenant actual');
    }

    return {
      ...entity,
      organizationId: this.tenantId,
    };
  }

  // Método de conveniencia para encontrar todos con filtro de tenant
  async findAllWithTenant<T extends TenantAwareEntity>(
    repository: Repository<T>,
    options: FindManyOptions<T> = {},
  ): Promise<T[]> {
    return repository.find(this.addTenantFilter(options));
  }

  // Método de conveniencia para encontrar uno con filtro de tenant
  async findOneWithTenant<T extends TenantAwareEntity>(
    repository: Repository<T>,
    options: FindOneOptions<T>,
  ): Promise<T | null> {
    return repository.findOne(this.addTenantFilterOne(options));
  }

  // Método de conveniencia para crear con tenant
  async createWithTenant<T extends TenantAwareEntity>(
    repository: Repository<T>,
    entityData: Omit<T, 'organizationId'>,
  ): Promise<T> {
    const entityWithTenant = this.addTenantToEntity(entityData);
    return repository.save(entityWithTenant as any);
  }

  // Método de conveniencia para actualizar con verificación de tenant
  async updateWithTenant<T extends TenantAwareEntity>(
    repository: Repository<T>,
    id: string | number,
    updateData: Partial<Omit<T, 'organizationId'>>,
  ): Promise<T | null> {
    // Primero verificar que la entidad pertenece al tenant actual
    const entity = await this.findOneWithTenant(repository, {
      where: { id } as any,
    });
    if (!entity) {
      return null;
    }

    // Actualizar la entidad
    await repository.update(id, updateData as any);

    // Devolver la entidad actualizada
    return this.findOneWithTenant(repository, { where: { id } as any });
  }

  // Método de conveniencia para eliminar con verificación de tenant
  async deleteWithTenant<T extends TenantAwareEntity>(
    repository: Repository<T>,
    id: string | number,
  ): Promise<boolean> {
    // Verificar que la entidad pertenece al tenant actual
    const entity = await this.findOneWithTenant(repository, {
      where: { id } as any,
    });
    if (!entity) {
      return false;
    }

    // Eliminar la entidad
    const result = await repository.delete(id);
    return result.affected > 0;
  }
}
