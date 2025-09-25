// src/modules/common/services/pagination.service.ts
import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../dto/pagination-response.dto';

@Injectable()
export class PaginationService {
  /**
   * Servicio de paginación genérico que funciona con Repository o QueryBuilder
   */
  async paginate<T>(
    repository: Repository<T> | SelectQueryBuilder<T>,
    paginationDto: PaginationDto,
    alias?: string,
  ): Promise<PaginatedResponseDto<T>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;

    let queryBuilder: SelectQueryBuilder<T>;

    // Determinar si es Repository o QueryBuilder
    if (repository instanceof Repository) {
      // Si es Repository, crear QueryBuilder
      const entityAlias = alias || 'entity';
      queryBuilder = repository.createQueryBuilder(entityAlias);
    } else {
      // Si ya es QueryBuilder, usarlo directamente
      queryBuilder = repository;
    }

    // Aplicar ordenamiento si se especifica
    if (sortBy) {
      // Si se proporciona alias y no contiene punto, añadir el alias
      let orderField = sortBy;
      if (alias && !sortBy.includes('.')) {
        orderField = `${alias}.${sortBy}`;
      }
      queryBuilder.orderBy(orderField, sortOrder);
    }

    // Aplicar paginación
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Ejecutar consulta
    const [data, totalItems] = await queryBuilder.getManyAndCount();

    // Construir metadata
    const meta: PaginationMetaDto = {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNextPage: page < Math.ceil(totalItems / limit),
      hasPreviousPage: page > 1,
    };

    return { data, meta };
  }

  /**
   * Método simplificado para usar con Repository directamente
   */
  async paginateRepository<T>(
    repository: Repository<T>,
    paginationDto: PaginationDto,
    options?: {
      relations?: string[];
      where?: any;
      select?: (keyof T)[];
      alias?: string;
    },
  ): Promise<PaginatedResponseDto<T>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;

    const alias = options?.alias || 'entity';
    const queryBuilder = repository.createQueryBuilder(alias);

    // Aplicar selección de campos
    if (options?.select) {
      const selectFields = options.select.map(
        (field) => `${alias}.${String(field)}`,
      );
      queryBuilder.select(selectFields);
    }

    // Aplicar relaciones
    if (options?.relations) {
      options.relations.forEach((relation) => {
        queryBuilder.leftJoinAndSelect(`${alias}.${relation}`, relation);
      });
    }

    // Aplicar condiciones WHERE
    if (options?.where) {
      Object.keys(options.where).forEach((key, index) => {
        const value = options.where[key];
        if (index === 0) {
          queryBuilder.where(`${alias}.${key} = :${key}`, { [key]: value });
        } else {
          queryBuilder.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
        }
      });
    }

    // Aplicar ordenamiento
    if (sortBy) {
      const orderField = sortBy.includes('.') ? sortBy : `${alias}.${sortBy}`;
      queryBuilder.orderBy(orderField, sortOrder);
    }

    // Aplicar paginación
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    const meta: PaginationMetaDto = {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNextPage: page < Math.ceil(totalItems / limit),
      hasPreviousPage: page > 1,
    };

    return { data, meta };
  }

  /**
   * Crear metadata de paginación manualmente
   */
  createPaginationMeta(
    page: number,
    limit: number,
    totalItems: number,
  ): PaginationMetaDto {
    return {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNextPage: page < Math.ceil(totalItems / limit),
      hasPreviousPage: page > 1,
    };
  }
}
