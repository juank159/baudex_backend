// src/bank-accounts/dto/create-bank-account-movement.dto.ts
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, IsDateString } from 'class-validator';
import { BankAccountMovementType } from '../entities/bank-account-movement.entity';

/**
 * DTO para registrar un movement manual (depósito, retiro, ajuste, etc.).
 * Para invoice/credit/expense payments el movement se crea automáticamente
 * desde el módulo correspondiente, no por este endpoint.
 */
export class CreateBankAccountMovementDto {
  @IsEnum(BankAccountMovementType, {
    message: 'Tipo de movimiento inválido',
  })
  type: BankAccountMovementType;

  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a cero' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  movementDate?: string;
}

export class TransferBetweenAccountsDto {
  @IsUUID()
  fromAccountId: string;

  @IsUUID()
  toAccountId: string;

  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a cero' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  movementDate?: string;
}
