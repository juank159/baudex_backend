// src/dashboard/dto/profitability-query.dto.ts
import { IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ProfitabilityQueryDto {
  @ApiProperty({
    description: 'Fecha de inicio del período',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Fecha de fin del período',
    example: '2024-01-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'ID del almacén para filtrar',
    example: 'uuid-warehouse-id',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({
    description: 'ID de la categoría para filtrar',
    example: 'uuid-category-id',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    description: 'Límite de productos en top/bottom rankings',
    example: 5,
    required: false,
    default: 5,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 5;
}
