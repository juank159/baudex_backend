import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationType,
  NotificationSeverity,
} from '../entities/notification.entity';

/**
 * DTO para consultar notificaciones con filtros y paginación
 */
export class QueryNotificationsDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsEnum(NotificationSeverity)
  severity?: NotificationSeverity;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  // Paginación basada en página (alternativa a offset)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  // Ordenamiento
  @IsOptional()
  @IsString()
  @IsIn(['timestamp', 'createdAt', 'type', 'severity', 'isRead'])
  sortBy?: string = 'timestamp';

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: string = 'DESC';
}
