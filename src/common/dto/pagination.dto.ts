import { Type } from 'class-transformer';
import {
  IsOptional,
  IsPositive,
  Max,
  Min,
  IsString,
  IsEnum,
} from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'La página debe ser un número positivo' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'El límite debe ser un número positivo' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo es 100' })
  limit?: number = 10;

  @IsOptional()
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  sortBy?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
