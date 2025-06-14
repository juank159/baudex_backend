import { IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export enum KpiCategory {
  SALES = 'sales',
  EXPENSES = 'expenses',
  PROFITABILITY = 'profitability',
  CUSTOMERS = 'customers',
  INVENTORY = 'inventory',
  CASH_FLOW = 'cash_flow',
  ALL = 'all',
}

export class KpiQueryDto {
  @IsOptional()
  @IsEnum(KpiCategory, {
    message: 'La categoría de KPI debe ser válida',
  })
  category?: KpiCategory = KpiCategory.ALL;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser válida' })
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'compareWithPrevious debe ser un booleano' })
  compareWithPrevious?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'includeProjections debe ser un booleano' })
  includeProjections?: boolean = false;
}
