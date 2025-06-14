import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  IsUUID,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ExpenseStatus,
  ExpenseType,
  PaymentMethod,
} from '../entities/expense.entity';

export class ExpenseQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La página debe ser un número' })
  @Min(1, { message: 'La página debe ser mayor a 0' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  @Max(100, { message: 'El límite no puede ser mayor a 100' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  search?: string;

  @IsOptional()
  @IsEnum(ExpenseStatus, {
    message: 'El estado debe ser draft, pending, approved, rejected o paid',
  })
  status?: ExpenseStatus;

  @IsOptional()
  @IsEnum(ExpenseType, {
    message:
      'El tipo debe ser operating, administrative, sales, financial o extraordinary',
  })
  type?: ExpenseType;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'El método de pago debe ser cash, credit_card, debit_card, bank_transfer, check u other',
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de la categoría debe ser un UUID válido' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del creador debe ser un UUID válido' })
  createdById?: string;

  @IsOptional()
  @IsString({ message: 'El proveedor debe ser una cadena' })
  vendor?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser una fecha válida' })
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto mínimo debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El monto mínimo debe ser mayor o igual a 0' })
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto máximo debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El monto máximo debe ser mayor o igual a 0' })
  maxAmount?: number;

  @IsOptional()
  @IsArray({ message: 'Las etiquetas deben ser un array' })
  @IsString({ each: true, message: 'Cada etiqueta debe ser una cadena' })
  tags?: string[];

  @IsOptional()
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  @IsEnum(
    [
      'description',
      'amount',
      'date',
      'status',
      'type',
      'vendor',
      'createdAt',
      'updatedAt',
    ],
    {
      message: 'El campo de ordenamiento no es válido',
    },
  )
  sortBy?: string = 'date';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
