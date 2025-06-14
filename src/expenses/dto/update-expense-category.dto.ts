import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { ExpenseCategoryStatus } from '../entities/expense-category.entity';

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'El color debe ser una cadena' })
  @Matches(/^#[0-9A-F]{6}$/i, {
    message: 'El color debe ser un código hexadecimal válido',
  })
  color?: string;

  @IsOptional()
  @IsEnum(ExpenseCategoryStatus, {
    message: 'El estado debe ser active o inactive',
  })
  status?: ExpenseCategoryStatus;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El presupuesto debe tener máximo 2 decimales' },
  )
  @Min(0, { message: 'El presupuesto debe ser mayor o igual a 0' })
  monthlyBudget?: number;

  @IsOptional()
  @IsBoolean({ message: 'isRequired debe ser un valor booleano' })
  isRequired?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'El orden debe ser un número' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  sortOrder?: number;
}
