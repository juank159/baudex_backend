import {
  IsString,
  IsDateString,
  IsEnum,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/invoice.entity';

export class CreateInvoiceItemDto {
  @IsString({ message: 'La descripción es requerida' })
  @MaxLength(200, { message: 'La descripción no puede exceder 200 caracteres' })
  description: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La cantidad debe tener máximo 2 decimales' },
  )
  @Min(0.01, { message: 'La cantidad debe ser mayor a 0' })
  quantity: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El precio debe ser mayor o igual a 0' })
  unitPrice: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El descuento debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El descuento debe ser mayor o igual a 0' })
  discountPercentage?: number = 0;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El descuento debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El descuento debe ser mayor o igual a 0' })
  discountAmount?: number = 0;

  @IsOptional()
  @IsString({ message: 'La unidad debe ser una cadena' })
  @MaxLength(20, { message: 'La unidad no puede exceder 20 caracteres' })
  unit?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena' })
  notes?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del producto debe ser un UUID válido' })
  productId?: string;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString({ message: 'El número de factura debe ser una cadena' })
  @MaxLength(50, {
    message: 'El número de factura no puede exceder 50 caracteres',
  })
  number?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser una fecha válida' })
  date?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de vencimiento debe ser una fecha válida' },
  )
  dueDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'El método de pago debe ser cash, credit_card, debit_card, bank_transfer, check, credit u other',
  })
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El porcentaje de impuesto debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El porcentaje de impuesto debe ser mayor o igual a 0' })
  taxPercentage?: number = 19; // IVA Colombia

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El descuento debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El descuento debe ser mayor o igual a 0' })
  discountPercentage?: number = 0;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El descuento debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El descuento debe ser mayor o igual a 0' })
  discountAmount?: number = 0;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'Los términos deben ser una cadena' })
  terms?: string;

  @IsOptional()
  @IsObject({ message: 'Los metadatos deben ser un objeto' })
  metadata?: Record<string, any>;

  @IsUUID('4', { message: 'El ID del cliente debe ser un UUID válido' })
  customerId: string;

  @IsArray({ message: 'Los items deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
