// src/bank-accounts/dto/bank-account-query.dto.ts
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { BankAccountType } from '../entities/bank-account.entity';

export class BankAccountQueryDto {
  @IsOptional()
  @IsEnum(BankAccountType)
  type?: BankAccountType;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
