import { Injectable } from '@nestjs/common';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserQueryDto } from '../dto/user-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/pagination-response.dto';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async findAllPaginated(
    query: UserQueryDto,
  ): Promise<PaginatedResponseDto<User>> {
    const queryBuilder = this.createQueryBuilder('user');

    // Aplicar filtros
    this.applyFilters(queryBuilder, query);

    // Aplicar búsqueda
    if (query.search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Aplicar ordenamiento
    queryBuilder.orderBy(`user.${query.sortBy}`, query.sortOrder);

    // Aplicar paginación
    const offset = (query.page - 1) * query.limit;
    queryBuilder.skip(offset).take(query.limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    const meta: PaginationMetaDto = {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit),
      hasNextPage: query.page < Math.ceil(totalItems / query.limit),
      hasPreviousPage: query.page > 1,
    };

    return { data, meta };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({
      where: { email },
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

  async findActiveById(id: string): Promise<User | null> {
    return this.findOne({
      where: {
        id,
        status: UserStatus.ACTIVE,
      },
      relations: ['products'],
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.update(id, { lastLoginAt: new Date() });
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.find({
      where: { role, status: UserStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<User>,
    query: UserQueryDto,
  ): void {
    if (query.role) {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status) {
      queryBuilder.andWhere('user.status = :status', { status: query.status });
    }
  }
}
