import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum ReportType {
  SALES_SUMMARY = 'sales_summary',
  EXPENSE_REPORT = 'expense_report',
  PROFIT_LOSS = 'profit_loss',
  CUSTOMER_ANALYSIS = 'customer_analysis',
  PRODUCT_PERFORMANCE = 'product_performance',
  CASH_FLOW = 'cash_flow',
  TAX_REPORT = 'tax_report',
  INVENTORY_REPORT = 'inventory_report',
}

export enum ReportFormat {
  JSON = 'json',
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
}

export class ReportQueryDto {
  @IsEnum(ReportType, {
    message: 'El tipo de reporte debe ser válido',
  })
  reportType: ReportType;

  @IsOptional()
  @IsEnum(ReportFormat, {
    message: 'El formato debe ser válido',
  })
  format?: ReportFormat = ReportFormat.JSON;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser válida' })
  endDate?: string;

  @IsOptional()
  @IsArray({ message: 'Los filtros deben ser un array' })
  @IsString({ each: true, message: 'Cada filtro debe ser una cadena' })
  filters?: string[];

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'includeCharts debe ser un booleano' })
  includeCharts?: boolean = true;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'includeDetails debe ser un booleano' })
  includeDetails?: boolean = true;

  @IsOptional()
  @IsString({ message: 'El título debe ser una cadena' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena' })
  description?: string;
}
