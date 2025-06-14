import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus, PaymentMethod } from '../entities/invoice.entity';

export class InvoiceQueryDto {
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
  @IsEnum(InvoiceStatus, {
    message:
      'El estado debe ser draft, pending, paid, overdue, cancelled o partially_paid',
  })
  status?: InvoiceStatus;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'El método de pago debe ser cash, credit_card, debit_card, bank_transfer, check, credit u other',
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del cliente debe ser un UUID válido' })
  customerId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del creador debe ser un UUID válido' })
  createdById?: string;

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
  @IsString({
    message: 'El campo de ordenamiento debe ser una cadena de texto',
  })
  @IsEnum(
    [
      'number',
      'date',
      'dueDate',
      'status',
      'total',
      'paidAmount',
      'balanceDue',
      'createdAt',
      'updatedAt',
    ],
    {
      message: 'El campo de ordenamiento no es válido',
    },
  )
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], {
    message: 'El orden debe ser ASC o DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
