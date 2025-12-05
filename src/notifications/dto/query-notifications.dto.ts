import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationType,
  NotificationSeverity,
} from '../entities/notification.entity';

/**
 * DTO para consultar notificaciones con filtros
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
}
