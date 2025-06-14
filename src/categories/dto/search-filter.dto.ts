import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsDateString,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryStatus } from '../entities/category.entity';

// ==================== SEARCH DTO ====================

export class CategorySearchDto {
  @IsString({ message: 'El término de búsqueda es requerido' })
  @MinLength(2, { message: 'El término debe tener al menos 2 caracteres' })
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  @Max(50, { message: 'El límite no puede ser mayor a 50' })
  limit?: number = 10;

  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'El estado debe ser válido' })
  status?: CategoryStatus;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del padre debe ser un UUID válido' })
  parentId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'includeChildren debe ser un valor booleano' })
  includeChildren?: boolean = false;
}

// ==================== ADVANCED FILTER DTO ====================

export class CategoryFilterDto {
  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'El estado debe ser válido' })
  status?: CategoryStatus;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del padre debe ser un UUID válido' })
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El nivel debe ser un número' })
  @Min(0, { message: 'El nivel debe ser mayor o igual a 0' })
  @Max(5, { message: 'El nivel no puede ser mayor a 5' })
  level?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasProducts?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasChildren?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de creación desde debe ser válida' })
  createdFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de creación hasta debe ser válida' })
  createdTo?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de actualización desde debe ser válida' })
  updatedFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de actualización hasta debe ser válida' })
  updatedTo?: string;
}

// ==================== TREE QUERY DTO ====================

export class CategoryTreeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxDepth debe ser un número' })
  @Min(1, { message: 'maxDepth debe ser mayor a 0' })
  @Max(5, { message: 'maxDepth no puede ser mayor a 5' })
  maxDepth?: number = 3;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeProductCount?: boolean = false;

  @IsOptional()
  @IsUUID('4', { message: 'rootCategoryId debe ser un UUID válido' })
  rootCategoryId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  flatStructure?: boolean = false; // Para obtener lista plana en lugar de árbol
}

// ==================== ANALYTICS QUERY DTO ====================

export class CategoryAnalyticsQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'Fecha desde debe ser válida' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha hasta debe ser válida' })
  dateTo?: string;

  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'], {
    message: 'El período debe ser day, week, month o year',
  })
  period?: 'day' | 'week' | 'month' | 'year' = 'month';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSubcategories?: boolean = true;

  @IsOptional()
  @IsEnum(['views', 'products', 'sales', 'all'], {
    message: 'El tipo de métrica debe ser válido',
  })
  metricType?: 'views' | 'products' | 'sales' | 'all' = 'all';
}

// ==================== SEARCH RESPONSE DTOS ====================

export class CategorySearchResultDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  status: CategoryStatus;
  level: number;
  hasChildren: boolean;
  productsCount?: number;
  parent?: {
    id: string;
    name: string;
    slug: string;
  };
  breadcrumbs?: string[];
}

export class CategorySearchResponseDto {
  query: string;
  results: CategorySearchResultDto[];
  totalFound: number;
  limit: number;
  searchTime: number; // en ms
  filters?: CategorySearchDto;
}

// ==================== FILTER RESPONSE DTOS ====================

export class CategoryFilterResponseDto {
  data: any[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: CategoryFilterDto;
  appliedAt: Date;
}
