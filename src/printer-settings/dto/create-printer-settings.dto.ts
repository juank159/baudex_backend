import { IsString, IsEnum, IsOptional, IsInt, IsBoolean, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrinterConnectionType, PrinterPaperSize } from '../entities/printer-settings.entity';

export class CreatePrinterSettingsDto {
  @ApiProperty({ description: 'Nombre de la impresora' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: PrinterConnectionType, description: 'Tipo de conexión' })
  @IsEnum(PrinterConnectionType)
  connectionType: PrinterConnectionType;

  @ApiPropertyOptional({ description: 'Dirección IP (para red)' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Puerto (default 9100)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Ruta USB' })
  @IsOptional()
  @IsString()
  usbPath?: string;

  @ApiProperty({ enum: PrinterPaperSize, description: 'Tamaño de papel' })
  @IsEnum(PrinterPaperSize)
  paperSize: PrinterPaperSize;

  @ApiPropertyOptional({ description: 'Corte automático', default: true })
  @IsOptional()
  @IsBoolean()
  autoCut?: boolean;

  @ApiPropertyOptional({ description: 'Abrir cajón', default: false })
  @IsOptional()
  @IsBoolean()
  cashDrawer?: boolean;

  @ApiPropertyOptional({ description: 'Es impresora por defecto', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
