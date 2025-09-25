// ==================== ENHANCED RESPONSE DTOS ====================

import { Exclude, Expose, Transform, Type } from 'class-transformer';
import { CategoryStatus } from '../entities/category.entity';

export class CategoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  slug: string;

  @Expose()
  image?: string;

  @Expose()
  status: CategoryStatus;

  @Expose()
  sortOrder: number;

  @Expose()
  parentId?: string;

  @Expose()
  @Type(() => CategoryResponseDto)
  parent?: CategoryResponseDto;

  @Expose()
  @Type(() => CategoryResponseDto)
  children?: CategoryResponseDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  deletedAt?: Date;

  // ==================== COMPUTED PROPERTIES ====================

  @Expose()
  @Transform(
    ({ obj }) => obj.status === CategoryStatus.ACTIVE && !obj.deletedAt,
  )
  isActive: boolean;

  @Expose()
  @Transform(({ obj }) => obj.children && obj.children.length > 0)
  isParent: boolean;

  @Expose()
  @Transform(({ obj }) => {
    let level = 0;
    let current = obj.parent;
    while (current) {
      level++;
      current = current.parent;
    }
    return level;
  })
  level: number;

  @Expose()
  @Transform(({ obj }) => obj.productsCount || 0)
  productsCount: number;

  // ==================== SEO FIELDS ====================

  @Expose()
  metaTitle?: string;

  @Expose()
  metaDescription?: string;

  @Expose()
  metaKeywords?: string;
}

// ==================== TREE RESPONSE DTOS ====================

export class CategoryTreeDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  image?: string;

  @Expose()
  sortOrder: number;

  @Expose()
  @Type(() => CategoryTreeDto)
  children?: CategoryTreeDto[];

  @Expose()
  productsCount?: number;

  @Expose()
  level: number;

  @Expose()
  hasChildren: boolean;
}

export class CategoryBreadcrumbDto {
  id: string;
  name: string;
  slug: string;
  level: number;
}

export class CategoryWithBreadcrumbsDto extends CategoryResponseDto {
  breadcrumbs: CategoryBreadcrumbDto[];
  fullPath: string;
}

// ==================== STATISTICS DTOS ====================

export class CategoryStatsDto {
  total: number;
  active: number;
  inactive: number;
  parents: number;
  children: number;
  deleted: number;
  withProducts: number;
  withoutProducts: number;
  byLevel: { [level: number]: number };
  lastUpdated: Date;
  generatedBy?: string;
}

export class CategoryDetailedStatsDto extends CategoryStatsDto {
  averageProductsPerCategory: number;
  mostPopularCategories: {
    id: string;
    name: string;
    slug: string;
    productsCount: number;
  }[];
  categoriesWithoutProducts: {
    id: string;
    name: string;
    slug: string;
    level: number;
  }[];
  recentlyCreated: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  }[];
  recentlyUpdated: {
    id: string;
    name: string;
    slug: string;
    updatedAt: Date;
  }[];
}

// ==================== HEALTH CHECK DTOS ====================

export class CategoryHealthIssueDto {
  type:
    | 'orphan'
    | 'circular'
    | 'duplicate_slug'
    | 'invalid_sort'
    | 'missing_parent'
    | 'depth_exceeded';
  description: string;
  categoryId?: string;
  categoryName?: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

export class CategoryHealthCheckDto {
  status: 'healthy' | 'issues_found' | 'critical';
  issues: CategoryHealthIssueDto[];
  checkedAt: Date;
  totalChecked: number;
  healthScore: number; // 0-100
  recommendations: string[];
}

// ==================== API RESPONSE WRAPPER DTOS ====================

export class CategoryApiResponseDto<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
  path?: string;
  statusCode: number;
  meta?: any;
}

export class CategoryListResponseDto {
  data: CategoryResponseDto[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters?: any;
  appliedAt: Date;
}

// ==================== MAINTENANCE DTOS ====================

export class CategoryMaintenanceResultDto {
  operation: string;
  success: boolean;
  message: string;
  affectedCategories: number;
  details?: {
    fixed: number;
    errors: number;
    warnings: number;
    issues: string[];
  };
  executedBy: string;
  executedAt: Date;
}

export class TreeRebuildOptionsDto {
  @Type(() => Boolean)
  fixSortOrder?: boolean = true;

  @Type(() => Boolean)
  validateHierarchy?: boolean = true;

  @Type(() => Boolean)
  dryRun?: boolean = false;

  @Type(() => Boolean)
  removeOrphans?: boolean = false;

  @Type(() => Boolean)
  fixDuplicateSlugs?: boolean = false;
}

export class TreeRebuildResultDto extends CategoryMaintenanceResultDto {
  details: {
    fixed: number;
    errors: number;
    warnings: number;
    issues: string[];
    orphansRemoved: number;
    slugsFixed: number;
    sortOrderFixed: number;
  };
}

// ==================== AUDIT DTOS ====================

export class CategoryAuditEventDto {
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'restored'
    | 'status_changed'
    | 'reordered';
  timestamp: Date;
  userId: string;
  userEmail: string;
  categoryId: string;
  categoryName: string;
  details: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    metadata?: any;
  };
  ipAddress?: string;
  userAgent?: string;
}

export class CategoryAuditLogDto {
  categoryId: string;
  categoryName: string;
  events: CategoryAuditEventDto[];
  totalEvents: number;
  dateRange: {
    from: Date;
    to: Date;
  };
}

// ==================== ANALYTICS DTOS ====================

export class CategoryAnalyticsDto {
  categoryId: string;
  categoryName: string;
  period: {
    from: Date;
    to: Date;
  };
  metrics: {
    views: number;
    products: number;
    sales?: number;
    revenue?: number;
  };
  trends: {
    viewsGrowth: number; // percentage
    productsGrowth: number;
    salesGrowth?: number;
  };
  comparisons: {
    parentCategory?: CategoryAnalyticsDto;
    childCategories?: CategoryAnalyticsDto[];
    similarCategories?: CategoryAnalyticsDto[];
  };
}

export class CategoryPerformanceDto {
  topCategories: {
    byViews: CategoryAnalyticsDto[];
    byProducts: CategoryAnalyticsDto[];
    bySales?: CategoryAnalyticsDto[];
  };
  bottomCategories: {
    byViews: CategoryAnalyticsDto[];
    byProducts: CategoryAnalyticsDto[];
    bySales?: CategoryAnalyticsDto[];
  };
  trends: {
    period: string;
    growth: number;
    decline: number;
    stable: number;
  };
}
