import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DashboardPeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_QUARTER = 'this_quarter',
  LAST_QUARTER = 'last_quarter',
  THIS_YEAR = 'this_year',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom',
}

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(DashboardPeriod, {
    message: 'El período debe ser válido',
  })
  period?: DashboardPeriod = DashboardPeriod.THIS_MONTH;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser válida' })
  endDate?: string;

  @IsOptional()
  @IsArray({ message: 'Las categorías deben ser un array' })
  @IsString({ each: true, message: 'Cada categoría debe ser una cadena' })
  categories?: string[];

  @IsOptional()
  @IsArray({ message: 'Los productos deben ser un array' })
  @IsString({ each: true, message: 'Cada producto debe ser una cadena' })
  products?: string[];

  @IsOptional()
  @IsArray({ message: 'Los clientes deben ser un array' })
  @IsString({ each: true, message: 'Cada cliente debe ser una cadena' })
  customers?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  limit?: number = 10;
}
