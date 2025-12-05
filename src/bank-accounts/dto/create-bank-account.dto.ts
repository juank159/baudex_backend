// src/bank-accounts/dto/create-bank-account.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { BankAccountType } from '../entities/bank-account.entity';

export class CreateBankAccountDto {
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsEnum(BankAccountType, {
    message: 'El tipo debe ser cash, savings, checking, digital_wallet, credit_card, debit_card u other',
  })
  type: BankAccountType;

  @IsOptional()
  @IsString({ message: 'El nombre del banco debe ser una cadena' })
  @MaxLength(100, { message: 'El nombre del banco no puede exceder 100 caracteres' })
  bankName?: string;

  @IsOptional()
  @IsString({ message: 'El número de cuenta debe ser una cadena' })
  @MaxLength(50, { message: 'El número de cuenta no puede exceder 50 caracteres' })
  accountNumber?: string;

  @IsOptional()
  @IsString({ message: 'El nombre del titular debe ser una cadena' })
  @MaxLength(200, { message: 'El nombre del titular no puede exceder 200 caracteres' })
  holderName?: string;

  @IsOptional()
  @IsString({ message: 'El icono debe ser una cadena' })
  @MaxLength(50, { message: 'El icono no puede exceder 50 caracteres' })
  icon?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  isActive?: boolean = true;

  @IsOptional()
  @IsBoolean({ message: 'isDefault debe ser un booleano' })
  isDefault?: boolean = false;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  sortOrder?: number = 0;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena' })
  description?: string;

  @IsOptional()
  @IsObject({ message: 'Los metadatos deben ser un objeto' })
  metadata?: Record<string, any>;
}
