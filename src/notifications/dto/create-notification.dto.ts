import { IsString, IsEnum, IsOptional, IsObject, IsUUID } from 'class-validator';
import {
  NotificationType,
  NotificationSeverity,
} from '../entities/notification.entity';

/**
 * DTO para crear una notificación
 */
export class CreateNotificationDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationSeverity)
  @IsOptional()
  severity?: NotificationSeverity;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsObject()
  @IsOptional()
  metadata?: {
    productId?: string;
    productName?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    customerId?: string;
    customerName?: string;
    batchId?: string;
    batchNumber?: string;
    quantity?: number;
    amount?: number;
    daysUntilExpiry?: number;
    daysOverdue?: number;
    usagePercent?: number;
    actionUrl?: string;
    actionLabel?: string;
  };

  @IsOptional()
  expiresAt?: Date;

  @IsOptional()
  sendEmail?: boolean; // Si debe enviar email además de notificación in-app
}
