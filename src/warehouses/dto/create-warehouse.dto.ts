import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarehouseDto {
  @ApiProperty({ description: 'Nombre del almacén', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Código único del almacén', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ description: 'Descripción del almacén' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Dirección del almacén' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Si el almacén está activo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
