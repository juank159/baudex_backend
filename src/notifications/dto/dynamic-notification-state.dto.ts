import {
  IsString,
  IsBoolean,
  IsArray,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';

/**
 * DTO para marcar una notificación dinámica como leída/no leída
 */
export class UpdateDynamicNotificationStateDto {
  @IsString()
  dynamicNotificationId: string;

  @IsBoolean()
  isRead: boolean;
}

/**
 * DTO para actualizar múltiples estados de notificaciones dinámicas
 */
export class BulkUpdateDynamicNotificationStateDto {
  @IsArray()
  @ArrayMinSize(1)
  dynamicNotificationIds: string[];

  @IsBoolean()
  isRead: boolean;
}

/**
 * DTO para sincronizar estados desde el frontend
 * Permite enviar múltiples estados en una sola petición
 */
export class SyncDynamicNotificationStatesDto {
  @IsArray()
  states: {
    dynamicNotificationId: string;
    isRead: boolean;
  }[];
}

/**
 * DTO para obtener estados de notificaciones dinámicas
 */
export class GetDynamicNotificationStatesDto {
  @IsArray()
  @IsOptional()
  dynamicNotificationIds?: string[];
}
