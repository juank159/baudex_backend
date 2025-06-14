import {
  IsString,
  IsNumber,
  IsDateString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';
import { ExpenseType, PaymentMethod } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsString({ message: 'La descripción es requerida' })
  @MinLength(3, { message: 'La descripción debe tener al menos 3 caracteres' })
  @MaxLength(200, { message: 'La descripción no puede exceder 200 caracteres' })
  description: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe tener máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser una fecha válida' })
  date?: string;

  @IsOptional()
  @IsEnum(ExpenseType, {
    message:
      'El tipo debe ser operating, administrative, sales, financial o extraordinary',
  })
  type?: ExpenseType = ExpenseType.OPERATING;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'El método de pago debe ser cash, credit_card, debit_card, bank_transfer, check u other',
  })
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @IsOptional()
  @IsString({ message: 'El proveedor debe ser una cadena' })
  @MaxLength(100, { message: 'El proveedor no puede exceder 100 caracteres' })
  vendor?: string;

  @IsOptional()
  @IsString({ message: 'El número de factura debe ser una cadena' })
  @MaxLength(50, {
    message: 'El número de factura no puede exceder 50 caracteres',
  })
  invoiceNumber?: string;

  @IsOptional()
  @IsString({ message: 'La referencia debe ser una cadena' })
  @MaxLength(100, { message: 'La referencia no puede exceder 100 caracteres' })
  reference?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena' })
  notes?: string;

  @IsOptional()
  @IsArray({ message: 'Los adjuntos deben ser un array' })
  @IsString({ each: true, message: 'Cada adjunto debe ser una URL válida' })
  attachments?: string[];

  @IsOptional()
  @IsArray({ message: 'Las etiquetas deben ser un array' })
  @IsString({ each: true, message: 'Cada etiqueta debe ser una cadena' })
  tags?: string[];

  @IsOptional()
  @IsObject({ message: 'Los metadatos deben ser un objeto' })
  metadata?: Record<string, any>;

  @IsUUID('4', { message: 'El ID de la categoría debe ser un UUID válido' })
  categoryId: string;
}
