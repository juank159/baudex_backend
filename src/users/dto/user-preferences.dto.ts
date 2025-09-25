import { IsBoolean, IsOptional, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({
    description: 'Descontar inventario automáticamente al crear facturas',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoDeductInventory?: boolean;

  @ApiPropertyOptional({
    description: 'Usar FIFO para cálculo de costos',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useFifoCosting?: boolean;

  @ApiPropertyOptional({
    description: 'Validar stock antes de crear factura',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  validateStockBeforeInvoice?: boolean;

  @ApiPropertyOptional({
    description: 'Permitir sobreventa (stock negativo)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowOverselling?: boolean;

  @ApiPropertyOptional({
    description: 'Mostrar alertas de stock bajo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  showStockWarnings?: boolean;

  @ApiPropertyOptional({
    description: 'Mostrar confirmaciones de acciones críticas',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  showConfirmationDialogs?: boolean;

  @ApiPropertyOptional({
    description: 'Modo compacto en listas',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  useCompactMode?: boolean;

  @ApiPropertyOptional({
    description: 'Recibir notificaciones de vencimientos',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enableExpiryNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Recibir notificaciones de stock bajo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enableLowStockNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Almacén por defecto para movimientos',
  })
  @IsOptional()
  @IsUUID()
  defaultWarehouseId?: string;

  @ApiPropertyOptional({
    description: 'Configuraciones adicionales en formato JSON',
  })
  @IsOptional()
  @IsObject()
  additionalSettings?: Record<string, any>;
}

export class UserPreferencesResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  autoDeductInventory: boolean;

  @ApiProperty()
  useFifoCosting: boolean;

  @ApiProperty()
  validateStockBeforeInvoice: boolean;

  @ApiProperty()
  allowOverselling: boolean;

  @ApiProperty()
  showStockWarnings: boolean;

  @ApiProperty()
  showConfirmationDialogs: boolean;

  @ApiProperty()
  useCompactMode: boolean;

  @ApiProperty()
  enableExpiryNotifications: boolean;

  @ApiProperty()
  enableLowStockNotifications: boolean;

  @ApiPropertyOptional()
  defaultWarehouseId?: string;

  @ApiPropertyOptional()
  additionalSettings?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
