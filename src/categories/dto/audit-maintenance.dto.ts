import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsString,
  IsUUID,
  IsArray,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ==================== AUDIT QUERY DTOS ====================

export class CategoryAuditQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'categoryId debe ser un UUID válido' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'userId debe ser un UUID válido' })
  userId?: string;

  @IsOptional()
  @IsEnum(
    [
      'created',
      'updated',
      'deleted',
      'restored',
      'status_changed',
      'reordered',
    ],
    {
      message: 'La acción debe ser válida',
    },
  )
  action?:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'restored'
    | 'status_changed'
    | 'reordered';

  @IsOptional()
  @IsDateString({}, { message: 'dateFrom debe ser una fecha válida' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateTo debe ser una fecha válida' })
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}

// ==================== MAINTENANCE OPERATION DTOS ====================

export class MaintenanceOperationDto {
  @IsEnum(
    [
      'rebuild_tree',
      'fix_sort_order',
      'remove_orphans',
      'fix_duplicate_slugs',
      'validate_hierarchy',
    ],
    {
      message: 'La operación debe ser válida',
    },
  )
  operation:
    | 'rebuild_tree'
    | 'fix_sort_order'
    | 'remove_orphans'
    | 'fix_duplicate_slugs'
    | 'validate_hierarchy';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BulkMaintenanceDto {
  @IsArray()
  @IsEnum(
    ['rebuild_tree', 'fix_sort_order', 'remove_orphans', 'fix_duplicate_slugs'],
    { each: true },
  )
  operations: (
    | 'rebuild_tree'
    | 'fix_sort_order'
    | 'remove_orphans'
    | 'fix_duplicate_slugs'
  )[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ==================== TREE REBUILD DTOS ====================

export class TreeRebuildOptionsDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  fixSortOrder?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  validateHierarchy?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  removeOrphans?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  fixDuplicateSlugs?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean = false;
}

export class TreeRebuildResultDto {
  operation: 'rebuild_tree';
  success: boolean;
  message: string;
  affectedCategories: number;
  details: {
    fixed: number;
    errors: number;
    warnings: number;
    issues: string[];
    orphansRemoved: number;
    slugsFixed: number;
    sortOrderFixed: number;
    hierarchyFixed: number;
  };
  executedBy: string;
  executedAt: Date;
  dryRun: boolean;
}

// ==================== HEALTH CHECK DTOS ====================

export class HealthCheckOptionsDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  checkOrphans?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  checkCircular?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  checkDuplicateSlugs?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  checkSortOrder?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  checkDepthLimits?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoFix?: boolean = false;
}

export class HealthIssueDto {
  type:
    | 'orphan'
    | 'circular'
    | 'duplicate_slug'
    | 'invalid_sort'
    | 'missing_parent'
    | 'depth_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  categoryId?: string;
  categoryName?: string;
  suggestion?: string;
  autoFixable: boolean;
}

export class HealthCheckResultDto {
  status: 'healthy' | 'issues_found' | 'critical';
  healthScore: number; // 0-100
  totalChecked: number;
  issues: HealthIssueDto[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
  checkedAt: Date;
  executedBy: string;
  autoFixed?: {
    count: number;
    issues: string[];
  };
}

// ==================== AUDIT EVENT DTOS ====================

export class CreateAuditEventDto {
  @IsUUID('4', { message: 'categoryId debe ser un UUID válido' })
  categoryId: string;

  @IsEnum([
    'created',
    'updated',
    'deleted',
    'restored',
    'status_changed',
    'reordered',
  ])
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'restored'
    | 'status_changed'
    | 'reordered';

  @IsOptional()
  details?: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    metadata?: any;
  };

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class AuditEventResponseDto {
  id: string;
  categoryId: string;
  categoryName: string;
  action: string;
  userId: string;
  userEmail: string;
  timestamp: Date;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

// ==================== BULK AUDIT DTOS ====================

export class BulkAuditQueryDto {
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds: string[];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum([
    'created',
    'updated',
    'deleted',
    'restored',
    'status_changed',
    'reordered',
  ])
  action?: string;
}

export class BulkAuditResponseDto {
  totalCategories: number;
  totalEvents: number;
  categories: {
    categoryId: string;
    categoryName: string;
    eventCount: number;
    events: AuditEventResponseDto[];
  }[];
  summary: {
    created: number;
    updated: number;
    deleted: number;
    restored: number;
    statusChanged: number;
    reordered: number;
  };
  generatedAt: Date;
  generatedBy: string;
}

// ==================== MAINTENANCE SCHEDULE DTOS ====================

export class ScheduleMaintenanceDto {
  @IsEnum(['daily', 'weekly', 'monthly'])
  frequency: 'daily' | 'weekly' | 'monthly';

  @IsArray()
  @IsEnum(['health_check', 'cleanup_orphans', 'fix_sort_order'], { each: true })
  operations: ('health_check' | 'cleanup_orphans' | 'fix_sort_order')[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoFix?: boolean = false;

  @IsOptional()
  @IsString()
  notificationEmail?: string;
}

export class MaintenanceScheduleResponseDto {
  id: string;
  frequency: string;
  operations: string[];
  autoFix: boolean;
  nextRun: Date;
  lastRun?: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}
