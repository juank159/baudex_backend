import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  DOUGHNUT = 'doughnut',
  AREA = 'area',
}

export enum ChartPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export class ChartQueryDto {
  @IsOptional()
  @IsEnum(ChartType, {
    message: 'El tipo de gráfico debe ser válido',
  })
  chartType?: ChartType = ChartType.LINE;

  @IsOptional()
  @IsEnum(ChartPeriod, {
    message: 'El período del gráfico debe ser válido',
  })
  chartPeriod?: ChartPeriod = ChartPeriod.DAILY;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser válida' })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'La métrica debe ser una cadena' })
  @IsEnum(['sales', 'expenses', 'profit', 'invoices', 'customers'], {
    message: 'La métrica debe ser válida',
  })
  metric?: string = 'sales';
}
